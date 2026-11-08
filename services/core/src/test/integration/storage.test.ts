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
import { accounts, assets, organizations } from '@credopass/lib/schemas/tables';
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
  process.env.S3_ENDPOINT ??= 'http://localhost:9000';
  process.env.S3_BUCKET ??= 'credopass-media-local';
  process.env.S3_ACCESS_KEY_ID ??= 'credopass';
  process.env.S3_SECRET_ACCESS_KEY ??= 'credopass';
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
