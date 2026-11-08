/**
 * Presigned uploads against real Postgres. ROADMAP stage 4.1.
 *
 * The bytes never pass through the API, so the guarantees have to live in
 * the signature and in `finalise`. These are the ones that would be security
 * bugs if they regressed: the key is ours, the tenant is scoped, the client's
 * word about the upload is not evidence, and an event cannot be pointed at an
 * unfinished or foreign asset.
 *
 * MinIO itself is not exercised here — `finalise` HEADs the object, which
 * needs a running bucket. That is the one gap, and it is called out in the
 * ROADMAP rather than faked with a mock that would prove nothing.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import * as Storage from '../../services/storage';
import * as Events from '../../services/event';
import { createTenantContext, type TenantContext } from '../../tenancy/context';
import { accounts, assets, events, organizations } from '@credopass/lib/schemas/tables';
import { POSTER_TEMPLATES } from '@credopass/lib/schemas/poster-templates';
import { eq } from 'drizzle-orm';

// A REAL account row, not a made-up uuid: `assets.uploaded_by_account_id` is
// a foreign key, and in production `ctx.accountId` always points at one.
let ACTOR: string;

let harness: TestDatabase;
let db: any;
let ctxA: TenantContext;
let ctxB: TenantContext;
let orgA: string;

beforeAll(async () => {
  process.env.PASS_SIGNING_KEY ??= 'test-signing-key-not-for-production';

  /**
   * `=`, not `??=`. The storage config is PINNED here, not defaulted.
   *
   * These five lines used to be `??=`, which means "unless the environment
   * already said otherwise" — and `services/core/.env` does say otherwise the
   * moment anyone switches local dev to R2 (D43). So the suite silently
   * stopped testing the MinIO fixture it describes and started reading the
   * real bucket's configuration, which is both the wrong thing to assert
   * against and a live credential in a test run.
   *
   * It showed up as "accepts our own ready asset, over plain http" failing:
   * `publicUrlFor` returned the r2.dev https URL, so the test's own premise
   * was gone. Same class of footgun as the exported `DATABASE_URL` that beats
   * `.env` (CLAUDE.md) — an ambient value quietly winning over the one the
   * code in front of you names.
   *
   * `S3_PUBLIC_URL` is set explicitly too. Left unset it falls back to
   * `${S3_ENDPOINT}/${S3_BUCKET}`, which is right for MinIO — but only by
   * coincidence, and a `.env` that sets it would leak straight back in.
   */
  process.env.S3_ENDPOINT = 'http://localhost:9000';
  process.env.S3_BUCKET = 'credopass-media-local';
  process.env.S3_ACCESS_KEY_ID = 'credopass';
  process.env.S3_SECRET_ACCESS_KEY = 'credopass';
  process.env.S3_PUBLIC_URL = 'http://localhost:9000/credopass-media-local';
  Storage.resetStorageForTests();
  harness = await getTestDatabase();
  db = harness.db;
});

beforeEach(async () => {
  await harness.reset();
  const [actor] = await db
    .insert(accounts)
    .values({ displayName: 'Test Owner', lastSeenAt: new Date() })
    .returning({ id: accounts.id });
  ACTOR = actor.id;
  const [a] = await db.insert(organizations).values({ name: 'A', slug: `a-${crypto.randomUUID().slice(0, 8)}` }).returning({ id: organizations.id });
  const [b] = await db.insert(organizations).values({ name: 'B', slug: `b-${crypto.randomUUID().slice(0, 8)}` }).returning({ id: organizations.id });
  orgA = a.id;
  ctxA = createTenantContext({ organizationId: a.id, accountId: ACTOR, role: 'owner' });
  ctxB = createTenantContext({ organizationId: b.id, accountId: ACTOR, role: 'owner' });
});

afterAll(async () => {
  await harness.stop();
});

describe('createUpload', () => {
  it('records a pending asset and signs a PUT for the declared type', async () => {
    const upload = await Storage.createUpload(db, ctxA, { contentType: 'image/jpeg' });

    expect(upload.uploadUrl).toContain('X-Amz-Signature');
    expect(upload.contentType).toBe('image/jpeg');

    const [row] = await db.select().from(assets).where(eq(assets.id, upload.assetId));
    expect(row.status).toBe('pending');
    expect(row.organizationId).toBe(orgA);
    expect(row.byteSize).toBeNull();
    expect(row.readyAt).toBeNull();
  });

  it('puts the key under the tenant prefix and never uses a client filename', async () => {
    // A client-supplied name would be a path-traversal and overwrite
    // primitive. The service takes no filename at all; this asserts the shape
    // it generates instead.
    const upload = await Storage.createUpload(db, ctxA, { contentType: 'image/png' });
    const [row] = await db.select().from(assets).where(eq(assets.id, upload.assetId));

    expect(row.storageKey).toBe(`org/${orgA}/poster/${upload.assetId}.png`);
    expect(row.storageKey).not.toContain('..');
  });

  it('refuses a type that is not an allowed raster image', async () => {
    // SVG especially: it can carry <script>, and the bucket serves downloads
    // anonymously, so an uploaded SVG would be stored XSS on our own origin.
    for (const bad of ['image/svg+xml', 'text/html', 'application/pdf', 'image/gif']) {
      await expect(
        Storage.createUpload(db, ctxA, { contentType: bad as never })
      ).rejects.toThrow();
    }
    expect(await db.select().from(assets)).toHaveLength(0);
  });

  it('accepts every type it claims to', async () => {
    for (const type of Storage.UPLOADABLE_IMAGE_TYPES) {
      const upload = await Storage.createUpload(db, ctxA, { contentType: type });
      expect(upload.assetId).toBeTruthy();
    }
    expect(await db.select().from(assets)).toHaveLength(Storage.UPLOADABLE_IMAGE_TYPES.length);
  });
});

describe('finaliseUpload', () => {
  it('404s another tenant, rather than 403ing', async () => {
    // A 403 would confirm the id exists. Golden rule 6.
    const upload = await Storage.createUpload(db, ctxA, { contentType: 'image/jpeg' });
    await expect(Storage.finaliseUpload(db, ctxB, upload.assetId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses to finalise an upload whose bytes never arrived', async () => {
    // The client calling `done` is not evidence that the PUT happened.
    const upload = await Storage.createUpload(db, ctxA, { contentType: 'image/jpeg' });
    await expect(Storage.finaliseUpload(db, ctxA, upload.assetId)).rejects.toThrow();

    const [row] = await db.select().from(assets).where(eq(assets.id, upload.assetId));
    expect(row.status).toBe('pending');
  });
});

describe('an event cover may only be ours-and-ready, or external https', () => {
  const baseEvent = () => ({
    name: 'Sunday Service',
    startAt: new Date(Date.now() + 86_400_000),
    locationText: 'Main hall',
  });

  it('refuses a pending upload', async () => {
    const upload = await Storage.createUpload(db, ctxA, { contentType: 'image/jpeg' });
    const [row] = await db.select().from(assets).where(eq(assets.id, upload.assetId));

    await expect(
      Events.createEvent(db, ctxA, {
        ...baseEvent(),
        coverImageUrl: Storage.publicUrlFor(row.storageKey),
      })
    ).rejects.toThrow();
  });

  it("refuses another organisation's ready asset", async () => {
    // Keys are UUIDs, but "unguessable" is not an access-control model.
    const upload = await Storage.createUpload(db, ctxB, { contentType: 'image/jpeg' });
    const [row] = await db.select().from(assets).where(eq(assets.id, upload.assetId));
    await db.update(assets).set({ status: 'ready', readyAt: new Date() }).where(eq(assets.id, upload.assetId));

    await expect(
      Events.createEvent(db, ctxA, {
        ...baseEvent(),
        coverImageUrl: Storage.publicUrlFor(row.storageKey),
      })
    ).rejects.toThrow();
  });

  it('accepts our own ready asset, over plain http, because it is ours', async () => {
    // Local MinIO is http on :9000. An https-only rule would reject exactly
    // the uploads this feature exists for; the ownership check is stronger.
    const upload = await Storage.createUpload(db, ctxA, { contentType: 'image/jpeg' });
    const [row] = await db.select().from(assets).where(eq(assets.id, upload.assetId));
    await db.update(assets).set({ status: 'ready', readyAt: new Date() }).where(eq(assets.id, upload.assetId));

    const url = Storage.publicUrlFor(row.storageKey);
    expect(url.startsWith('http://')).toBe(true);

    const event = await Events.createEvent(db, ctxA, { ...baseEvent(), coverImageUrl: url });
    expect(event.coverImageUrl).toBe(url);
  });

  /**
   * Built-in posters. These are the one value in the column that is NOT a
   * URL — they are root-relative paths, so a row written on localhost renders
   * on app.credopass.com and vice versa — and the thing worth asserting is
   * that the exemption is an allow-list and not a `/posters/` prefix rule.
   */
  it('accepts a built-in poster template', async () => {
    const event = await Events.createEvent(db, ctxA, {
      ...baseEvent(),
      coverImageUrl: POSTER_TEMPLATES[0].path,
    });
    expect(event.coverImageUrl).toBe(POSTER_TEMPLATES[0].path);
  });

  it('refuses a relative path that is not a known template', async () => {
    for (const bad of [
      '/posters/not-a-real-one.svg',
      '/posters/../../etc/passwd',
      '/posters/lime-arc.svg ',
      '/anything-else.svg',
    ]) {
      await expect(
        Events.createEvent(db, ctxA, { ...baseEvent(), coverImageUrl: bad })
      ).rejects.toThrow();
    }
  });

  it('accepts an external https link and refuses http, data: and javascript:', async () => {
    const ok = await Events.createEvent(db, ctxA, {
      ...baseEvent(),
      coverImageUrl: 'https://images.example.com/poster.jpg',
    });
    expect(ok.coverImageUrl).toBe('https://images.example.com/poster.jpg');

    for (const bad of [
      'http://images.example.com/poster.jpg',
      'data:image/png;base64,iVBORw0KGgo=',
      'javascript:alert(1)',
    ]) {
      await expect(
        Events.createEvent(db, ctxA, { ...baseEvent(), coverImageUrl: bad })
      ).rejects.toThrow();
    }
  });
});

/**
 * The sweep. These are the tests that stand between a cron job and deleting a
 * live event's poster, so they are written as the failure modes rather than
 * the happy path.
 *
 * `dryRun` throughout: the decision of WHAT to delete is the dangerous part
 * and the part worth asserting. Whether `S3Client.delete` works is MinIO's
 * problem, and exercising it here would make these tests depend on a running
 * bucket for no extra confidence.
 */
describe('sweepOrphanedMedia', () => {
  const longAgo = () => new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

  const baseEvent = () => ({
    name: 'Sunday Service',
    startAt: new Date(Date.now() + 86_400_000),
    locationText: 'Main hall',
  });

  const readyAsset = async (ctx: TenantContext, createdAt: Date) => {
    const upload = await Storage.createUpload(db, ctx, { contentType: 'image/jpeg' });
    await db
      .update(assets)
      .set({ status: 'ready', readyAt: createdAt, createdAt, byteSize: 1024 })
      .where(eq(assets.id, upload.assetId));
    const [row] = await db.select().from(assets).where(eq(assets.id, upload.assetId));
    return row;
  };

  it('NEVER takes an asset a live event still points at', async () => {
    const asset = await readyAsset(ctxA, longAgo());
    await Events.createEvent(db, ctxA, {
      ...baseEvent(),
      coverImageUrl: Storage.publicUrlFor(asset.storageKey),
    });

    const result = await Storage.sweepOrphanedMedia(db, { dryRun: true });
    expect(result.orphanedRemoved).toBe(0);
  });

  it('keeps an asset SHARED by two events when only one is deleted', async () => {
    // The Recents picker makes this ordinary: pick last week's poster for this
    // week's event and one object backs both. Deleting the object because one
    // of them went away would blank the other.
    const asset = await readyAsset(ctxA, longAgo());
    const url = Storage.publicUrlFor(asset.storageKey);
    const keep = await Events.createEvent(db, ctxA, { ...baseEvent(), coverImageUrl: url });
    const drop = await Events.createEvent(db, ctxA, { ...baseEvent(), coverImageUrl: url });

    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, drop.id));

    const result = await Storage.sweepOrphanedMedia(db, { dryRun: true });
    expect(result.orphanedRemoved).toBe(0);

    const [survivor] = await db.select().from(events).where(eq(events.id, keep.id));
    expect(survivor.coverImageUrl).toBe(url);
  });

  it('reclaims the poster once the LAST event referencing it is deleted', async () => {
    const asset = await readyAsset(ctxA, longAgo());
    const url = Storage.publicUrlFor(asset.storageKey);
    const ev = await Events.createEvent(db, ctxA, { ...baseEvent(), coverImageUrl: url });
    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, ev.id));

    const result = await Storage.sweepOrphanedMedia(db, { dryRun: true });
    expect(result.orphanedRemoved).toBe(1);
    expect(result.bytesReclaimed).toBe(1024);
  });

  it('spares a recent upload that is not attached to anything yet', async () => {
    // Someone has the composer open and has not pressed Create. For those
    // minutes the image is referenced by nothing, and the grace period — not
    // the schedule — is what stops the sweep taking it.
    await readyAsset(ctxA, new Date());
    const result = await Storage.sweepOrphanedMedia(db, { dryRun: true });
    expect(result.orphanedRemoved).toBe(0);
  });

  it('sweeps an abandoned pending upload without consulting references', async () => {
    const upload = await Storage.createUpload(db, ctxA, { contentType: 'image/jpeg' });
    await db
      .update(assets)
      .set({ createdAt: longAgo() })
      .where(eq(assets.id, upload.assetId));

    const result = await Storage.sweepOrphanedMedia(db, { dryRun: true });
    expect(result.pendingRemoved).toBe(1);
  });

  it("does not reclaim one organisation's asset because another deleted an event", async () => {
    const asset = await readyAsset(ctxA, longAgo());
    await Events.createEvent(db, ctxA, {
      ...baseEvent(),
      coverImageUrl: Storage.publicUrlFor(asset.storageKey),
    });
    const theirs = await Events.createEvent(db, ctxB, { ...baseEvent() });
    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, theirs.id));

    const result = await Storage.sweepOrphanedMedia(db, { dryRun: true });
    expect(result.orphanedRemoved).toBe(0);
  });
});

/**
 * `recentAssets` — what the composer's Recents row is allowed to offer.
 *
 * It is a picker over object-storage URLs, so the tenancy question is the
 * whole of it: one organisation must never be shown, and therefore never be
 * able to attach, another's uploads.
 */
describe('recentAssets', () => {
  const ready = async (ctx: TenantContext) => {
    const upload = await Storage.createUpload(db, ctx, { contentType: 'image/jpeg' });
    await db
      .update(assets)
      .set({ status: 'ready', readyAt: new Date() })
      .where(eq(assets.id, upload.assetId));
    return upload.assetId;
  };

  it("never lists another organisation's uploads", async () => {
    await ready(ctxA);
    const theirs = await ready(ctxB);

    const mine = await Storage.recentAssets(db, ctxA);
    expect(mine.length).toBe(1);
    expect(mine.map((a) => a.id)).not.toContain(theirs);
  });

  it('omits pending uploads, which may have no bytes behind them', async () => {
    await Storage.createUpload(db, ctxA, { contentType: 'image/jpeg' });
    expect(await Storage.recentAssets(db, ctxA)).toHaveLength(0);
  });

  it('omits assets the sweeper has reclaimed', async () => {
    const id = await ready(ctxA);
    await db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, id));
    expect(await Storage.recentAssets(db, ctxA)).toHaveLength(0);
  });

  it('returns newest first and honours the limit', async () => {
    for (let i = 0; i < 3; i += 1) await ready(ctxA);
    const page = await Storage.recentAssets(db, ctxA, 2);
    expect(page).toHaveLength(2);
    expect(new Date(page[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(page[1].createdAt).getTime()
    );
  });
});
