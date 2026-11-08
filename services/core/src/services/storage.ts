/**
 * StorageService — presigned uploads to S3/MinIO. ROADMAP stage 4.1.
 *
 * No framework imports (rule 3). Routes call this; it never sees a request.
 *
 * ## The shape, and why
 *
 * The browser PUTs **straight to object storage** with a short-lived
 * presigned URL. Bytes never pass through the API, so a 4MB photo does not
 * occupy a request worker, and the service does not need a body-size limit
 * big enough to swallow one.
 *
 * That hands control to the client for the duration of the PUT, so the
 * guarantees have to be baked into the signature rather than checked
 * afterwards:
 *
 *   · **The key is ours.** Generated from a fresh UUID under the tenant's own
 *     prefix. A client-supplied filename is a path-traversal and overwrite
 *     primitive — `../../other-org/posters/x.jpg` would write into another
 *     tenant's space, and a repeated name would silently replace a poster
 *     somebody is already using.
 *   · **The content type is ours.** S3 rejects a PUT whose `Content-Type`
 *     differs from the signed one, so signing `image/jpeg` means only a JPEG
 *     can land there. This is the real control; the allow-list below is what
 *     feeds it.
 *   · **The URL expires.** Ten minutes is long enough for a slow phone upload
 *     and short enough that a leaked URL is not a write credential.
 *
 * What a presigned PUT **cannot** enforce is size. S3's `content-length-range`
 * condition only exists for POST policies, not PUT signatures, so the size
 * ceiling is enforced on `finalise` by HEAD-ing the object and refusing an
 * oversized one. See `finaliseUpload`.
 */

import { and, desc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { S3Client } from 'bun';
import { assets, events } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import type { TenantContext } from '../tenancy/context';
import { ProblemCode, problem } from '../http/problem';

/**
 * What a poster may be.
 *
 * Raster only, and an explicit list rather than `image/*`. **SVG is excluded
 * deliberately**: it is a document format, it can carry `<script>`, and the
 * bucket serves downloads anonymously — an uploaded SVG would be stored XSS
 * on our own origin the moment anything renders it inline. AVIF and WebP are
 * accepted because modern phones produce them.
 */
export const UPLOADABLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type UploadableImageType = (typeof UPLOADABLE_IMAGE_TYPES)[number];

const EXTENSION: Record<UploadableImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * The hard ceiling, enforced on finalise.
 *
 * The browser downscales to a long edge of 2048px before uploading, which
 * puts a normal photo comfortably under 1MB. 8MB is the "something went
 * wrong, or someone is not using our client" line — generous enough never to
 * reject a real poster, small enough that a thousand of them is gigabytes
 * rather than terabytes.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** How long a signed PUT stays valid. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

/**
 * Abandoned `pending` rows older than this are sweepable.
 *
 * Not swept automatically yet — there is no scheduler (Phase 4). The index
 * `idx_assets_pending` exists so that when there is one, the query is cheap.
 */
export const PENDING_ASSET_TTL_MS = 24 * 60 * 60 * 1000;

interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /**
   * Where a finished object is publicly readable from.
   *
   * Separate from `endpoint` because they genuinely differ in production: the
   * API may sign against an internal endpoint while browsers fetch from a CDN
   * or a bucket domain. Locally they are the same MinIO.
   */
  publicBaseUrl: string;
}

let cached: { config: StorageConfig; client: S3Client } | null = null;

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    // Fail where the misconfiguration is, not at the first upload. A missing
    // key here means every poster upload 500s, and the error should say why.
    throw problem.internal(`Storage is not configured: ${name} is unset.`);
  }
  return value;
};

function storage(): { config: StorageConfig; client: S3Client } {
  if (cached) return cached;

  const endpoint = required('S3_ENDPOINT');
  const config: StorageConfig = {
    endpoint,
    bucket: required('S3_BUCKET'),
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    region: process.env.S3_REGION || 'us-east-1',
    publicBaseUrl: (process.env.S3_PUBLIC_URL || `${endpoint}/${required('S3_BUCKET')}`).replace(/\/$/, ''),
  };

  cached = {
    config,
    client: new S3Client({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucket: config.bucket,
      endpoint: config.endpoint,
      region: config.region,
    }),
  };
  return cached;
}

/** Test seam — forces the next call to re-read the environment. */
export const resetStorageForTests = (): void => {
  cached = null;
};

/** The URL a browser fetches a finished object from. */
export const publicUrlFor = (storageKey: string): string =>
  `${storage().config.publicBaseUrl}/${storageKey}`;

export interface PresignedUpload {
  assetId: string;
  uploadUrl: string;
  /** The browser MUST send exactly this, or S3 rejects the signature. */
  contentType: UploadableImageType;
  expiresInSeconds: number;
  maxBytes: number;
}

/**
 * Reserve a key and hand back a URL the browser can PUT to.
 *
 * Creates the asset row as `pending` first: if we signed a URL without
 * recording it, an upload that succeeded but was never finalised would be an
 * orphan in the bucket that nothing knows about and nothing can clean up.
 */
export async function createUpload(
  db: Database,
  ctx: TenantContext,
  input: { contentType: string; purpose?: 'poster' }
): Promise<PresignedUpload> {
  const contentType = input.contentType.toLowerCase().trim() as UploadableImageType;

  if (!UPLOADABLE_IMAGE_TYPES.includes(contentType)) {
    throw problem.badRequest(
      ProblemCode.VALIDATION_FAILED,
      `That file type is not supported. Use a JPEG, PNG, WebP or AVIF image.`
    );
  }

  const assetId = crypto.randomUUID();
  // Tenant prefix first so a bucket listing is grouped by owner, and so a
  // future bucket policy can be written per prefix.
  const storageKey = `org/${ctx.organizationId}/${input.purpose ?? 'poster'}/${assetId}.${EXTENSION[contentType]}`;

  await db.insert(assets).values({
    id: assetId,
    organizationId: ctx.organizationId,
    uploadedByAccountId: ctx.accountId,
    storageKey,
    contentType,
    status: 'pending',
  });

  const uploadUrl = storage().client.presign(storageKey, {
    method: 'PUT',
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    type: contentType,
  });

  return {
    assetId,
    uploadUrl,
    contentType,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    maxBytes: MAX_UPLOAD_BYTES,
  };
}

export interface FinalisedAsset {
  id: string;
  url: string;
  byteSize: number;
  contentType: string;
}

/**
 * Confirm the bytes arrived, and publish the URL.
 *
 * **The client's word is not evidence.** This HEADs the object: a client that
 * calls `finalise` without uploading, or that uploaded something enormous,
 * must not end up with a `ready` asset. Size is checked here because a
 * presigned PUT cannot carry a size condition — only a POST policy can — so
 * this is the only place the ceiling can be applied.
 *
 * An oversized object is deleted rather than left in the bucket: we signed
 * for it, so cleaning it up is ours to do.
 */
export async function finaliseUpload(
  db: Database,
  ctx: TenantContext,
  assetId: string
): Promise<FinalisedAsset> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.id, assetId),
        // Tenant-scoped: another organisation's asset is a 404, never a 403,
        // so the id space cannot be probed (golden rule 6).
        eq(assets.organizationId, ctx.organizationId),
        isNull(assets.deletedAt)
      )
    )
    .limit(1);

  if (!asset) throw problem.notFound(ProblemCode.NOT_FOUND, 'Upload not found.');

  // Idempotent: a retried finalise returns the same answer rather than
  // failing. The network between "PUT finished" and "finalise acknowledged"
  // is exactly where a retry happens.
  if (asset.status === 'ready') {
    return {
      id: asset.id,
      url: publicUrlFor(asset.storageKey),
      byteSize: asset.byteSize ?? 0,
      contentType: asset.contentType,
    };
  }

  const file = storage().client.file(asset.storageKey);

  // `stat()`, not `file.size` — the latter is NaN for an S3File, which got as
  // far as writing NaN into an integer column before the round-trip test
  // caught it. `stat()` is also one request that answers both questions.
  let stat: { size: number; type?: string };
  try {
    stat = await file.stat();
  } catch {
    throw problem.badRequest(
      ProblemCode.VALIDATION_FAILED,
      'That upload did not arrive. Try again.'
    );
  }

  const byteSize = stat.size;

  // What actually landed, versus what we signed for. S3 enforces this on the
  // PUT, so a mismatch means something unexpected is going on rather than an
  // ordinary client error — but a stored object whose type disagrees with the
  // row would be served to browsers with the wrong Content-Type, so it is
  // worth refusing rather than recording.
  const storedType = (stat.type ?? '').split(';')[0].trim().toLowerCase();
  if (storedType && storedType !== asset.contentType) {
    await file.delete().catch(() => undefined);
    await db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, asset.id));
    throw problem.badRequest(
      ProblemCode.VALIDATION_FAILED,
      'That upload did not match the file type it was reserved for.'
    );
  }

  if (byteSize > MAX_UPLOAD_BYTES) {
    await file.delete().catch(() => undefined);
    await db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, asset.id));
    throw problem.badRequest(
      ProblemCode.VALIDATION_FAILED,
      `That image is too large (${Math.round(byteSize / 1024 / 1024)}MB). The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`
    );
  }

  await db
    .update(assets)
    .set({ status: 'ready', byteSize, readyAt: new Date() })
    .where(eq(assets.id, asset.id));

  return {
    id: asset.id,
    url: publicUrlFor(asset.storageKey),
    byteSize,
    contentType: asset.contentType,
  };
}

/**
 * Is this URL one of ours, and ready?
 *
 * Used when an event's cover is set, so `events.cover_image_url` can only
 * point at a `ready` asset belonging to THIS organisation — not a `pending`
 * one, not another tenant's, and not an arbitrary host.
 *
 * Returns false for anything it does not recognise, which the caller treats
 * as "an external link" and validates on its own terms.
 */
export async function isOwnReadyAssetUrl(
  db: Database,
  ctx: TenantContext,
  url: string
): Promise<boolean> {
  const base = `${storage().config.publicBaseUrl}/`;
  if (!url.startsWith(base)) return false;

  const storageKey = url.slice(base.length);
  const [row] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(
      and(
        eq(assets.storageKey, storageKey),
        eq(assets.organizationId, ctx.organizationId),
        eq(assets.status, 'ready'),
        isNull(assets.deletedAt)
      )
    )
    .limit(1);

  return !!row;
}

/** Is a URL pointing at our bucket at all? Cheap, no database. */
export const looksLikeOwnStorage = (url: string): boolean =>
  url.startsWith(`${storage().config.publicBaseUrl}/`);

/** Count of abandoned uploads older than the TTL. For the eventual sweeper. */
export async function countAbandonedUploads(db: Database, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(assets)
    .where(
      and(
        eq(assets.status, 'pending'),
        sql`${assets.createdAt} < ${new Date(now.getTime() - PENDING_ASSET_TTL_MS)}`
      )
    );
  return row?.n ?? 0;
}

/**
 * The organisation's recent posters, newest first.
 *
 * **Why this exists.** The composer offered a built-in poster, a file upload,
 * or a pasted URL — and nothing for the image you uploaded last week. A church
 * running the same service every Sunday had to re-upload the same artwork for
 * every event, which costs them a round trip and costs the bucket a duplicate
 * object every time.
 *
 * Tenant-scoped like everything else (`organization_id`, explicitly — golden
 * rule 7), and `ready` only: a `pending` row is an upload that may never have
 * landed, and nothing user-facing may point at one.
 *
 * Deduplicated on the public URL. Re-selecting a recent poster for a second
 * event points both rows at the SAME object rather than copying it, which is
 * the entire saving — so the same asset must not appear twice in the picker.
 */
export async function recentAssets(
  db: Database,
  ctx: TenantContext,
  limit = 12
): Promise<Array<{ id: string; url: string; contentType: string; createdAt: string }>> {
  const rows = await db
    .select({
      id: assets.id,
      storageKey: assets.storageKey,
      contentType: assets.contentType,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .where(
      and(
        eq(assets.organizationId, ctx.organizationId),
        eq(assets.status, 'ready'),
        isNull(assets.deletedAt)
      )
    )
    .orderBy(desc(assets.createdAt))
    .limit(limit);

  const seen = new Set<string>();
  const out: Array<{ id: string; url: string; contentType: string; createdAt: string }> = [];
  for (const row of rows) {
    const url = publicUrlFor(row.storageKey);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      id: row.id,
      url,
      contentType: row.contentType,
      createdAt: row.createdAt.toISOString(),
    });
  }
  return out;
}

/**
 * Reclaim storage from posters nothing points at any more.
 *
 * **The ask was "delete the objects behind soft-deleted events, weekly".** The
 * query is deliberately not that, because an object is not owned by an event:
 *
 *   · Since the composer grew a **Recents** row, picking a previous poster
 *     points the new event at the SAME object. Deleting that object because
 *     one of the events referencing it was removed would blank the poster on
 *     every other event still using it.
 *   · The same URL can also be reached by two events in different
 *     organisations if one was pasted as a plain link.
 *
 * So the question this asks is not "was this event deleted" but **"does any
 * live event still reference this object"**. Deleting is irreversible; the
 * reference check is the whole safety property, and it is checked per object
 * rather than per event.
 *
 * Two classes are swept:
 *
 *   1. `pending` older than `PENDING_ASSET_TTL_MS` — a presigned URL was
 *      handed out and never confirmed. There may be no object at all; the
 *      delete is best-effort.
 *   2. `ready`, unreferenced, and older than `graceMs` — the poster of an
 *      event that has since been deleted, or an upload that was finalised and
 *      then never attached to anything.
 *
 * **The grace period is what makes the schedule unimportant.** An image
 * uploaded into a composer that has not been submitted yet is, for those few
 * minutes, referenced by nothing. A week of grace means a sweep that runs
 * daily, weekly, or twice because the service restarted can never take one.
 *
 * The row is soft-deleted, never dropped: `assets.deleted_at` is the record
 * that this key was ours and has been reclaimed, which is what stops a later
 * sweep trying again and what makes an accidental deletion visible.
 */
export interface SweepResult {
  pendingRemoved: number;
  orphanedRemoved: number;
  bytesReclaimed: number;
  /** Keys the storage provider refused to delete. Left for the next run. */
  failed: string[];
}

export const ORPHAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export async function sweepOrphanedMedia(
  db: Database,
  options: { now?: Date; graceMs?: number; dryRun?: boolean } = {}
): Promise<SweepResult> {
  const now = options.now ?? new Date();
  const graceMs = options.graceMs ?? ORPHAN_GRACE_MS;
  const dryRun = options.dryRun ?? false;

  const result: SweepResult = {
    pendingRemoved: 0,
    orphanedRemoved: 0,
    bytesReclaimed: 0,
    failed: [],
  };

  const candidates = await db
    .select({
      id: assets.id,
      storageKey: assets.storageKey,
      status: assets.status,
      byteSize: assets.byteSize,
    })
    .from(assets)
    .where(
      and(
        isNull(assets.deletedAt),
        or(
          and(
            eq(assets.status, 'pending'),
            lt(assets.createdAt, new Date(now.getTime() - PENDING_ASSET_TTL_MS))
          ),
          and(
            eq(assets.status, 'ready'),
            lt(assets.createdAt, new Date(now.getTime() - graceMs))
          )
        )
      )
    )
    .limit(500);

  if (candidates.length === 0) return result;

  /*
    One query for every live reference, rather than one per candidate.

    `cover_image_url` stores the absolute public URL, not the key, so the
    comparison happens on the URL. Events that are soft-deleted are excluded
    on purpose — reclaiming their posters is the point of the sweep.
  */
  const referenced = new Set(
    (
      await db
        .select({ url: events.coverImageUrl })
        .from(events)
        .where(and(isNull(events.deletedAt), isNotNull(events.coverImageUrl)))
    )
      .map((row) => row.url)
      .filter((url): url is string => Boolean(url))
  );

  for (const candidate of candidates) {
    // A `pending` row was never attached to anything by definition — nothing
    // user-facing may point at one — so it skips the reference check.
    if (candidate.status === 'ready' && referenced.has(publicUrlFor(candidate.storageKey))) {
      continue;
    }

    if (dryRun) {
      if (candidate.status === 'pending') result.pendingRemoved += 1;
      else {
        result.orphanedRemoved += 1;
        result.bytesReclaimed += candidate.byteSize ?? 0;
      }
      continue;
    }

    try {
      // Best effort. A `pending` key usually has no object behind it, and a
      // provider that 404s on delete has given us the outcome we wanted.
      await storage().client.file(candidate.storageKey).delete();
    } catch {
      // Anything else — credentials, a network blip — leaves the row alone so
      // the next run retries it. Never soft-delete a row whose bytes survive:
      // that is how an object becomes unreachable AND unreclaimable.
      if (candidate.status === 'ready') {
        result.failed.push(candidate.storageKey);
        continue;
      }
    }

    await db.update(assets).set({ deletedAt: now }).where(eq(assets.id, candidate.id));

    if (candidate.status === 'pending') result.pendingRemoved += 1;
    else {
      result.orphanedRemoved += 1;
      result.bytesReclaimed += candidate.byteSize ?? 0;
    }
  }

  return result;
}
