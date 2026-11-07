// ============================================================================
// FILE: packages/lib/src/schemas/tables/assets.ts
// ROADMAP.md stage 4.1 · docs/API-FIRST-REBUILD.md §9.1
// ============================================================================

import {
  pgTable, text, timestamp, index, uuid, integer, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { accounts } from './accounts';

/**
 * A file in object storage — today, event posters.
 *
 * **Postgres holds the key and the metadata. It never holds bytes.** The
 * browser PUTs straight to S3/MinIO with a presigned URL, so an upload never
 * passes through the API and a 4MB photo does not occupy a request worker.
 *
 * ## Why a row exists before the bytes do
 *
 * `status` is the whole design. A presigned PUT happens outside our control:
 * we hand out a URL and the browser may or may not use it. So the flow is
 *
 *   1. `pending`  — row created with the key we signed. No bytes yet.
 *   2. `ready`    — the client told us the PUT succeeded and we HEAD-ed the
 *                   object to confirm it is really there and how big it is.
 *
 * A row stuck in `pending` is an abandoned upload, which is garbage to sweep,
 * not a broken event. Without the row we would have no idea the key had ever
 * been handed out, and no way to attribute or clean up what landed there.
 *
 * **Nothing user-facing may point at a `pending` asset.** `events.cover_image_url`
 * is only written once an asset is `ready`.
 */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * The owning tenant. An asset is org-scoped like everything else, so one
     * organisation can never enumerate or reuse another's uploads.
     */
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    /** Who uploaded it. Null if that account is later removed — the file survives. */
    uploadedByAccountId: uuid('uploaded_by_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),

    /**
     * The object key, e.g. `org/<uuid>/posters/<uuid>.jpg`.
     *
     * Unique, and generated server-side from a fresh UUID — never from the
     * user's filename. A client-supplied key is a path-traversal and
     * overwrite primitive: `../../other-org/posters/x.jpg` would let one
     * tenant write into another's prefix.
     */
    storageKey: text('storage_key').notNull(),

    /** `pending` until the upload is confirmed, then `ready`. */
    status: text('status').notNull().default('pending'),

    /**
     * The media type we SIGNED FOR, which the presigned URL enforces: S3
     * rejects a PUT whose Content-Type differs from the signed one. So this
     * is a constraint on what can be stored, not a hint from the client.
     */
    contentType: text('content_type').notNull(),

    /** Bytes, read back from the object on finalise — not trusted from the client. */
    byteSize: integer('byte_size'),
    width: integer('width'),
    height: integer('height'),

    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    /** When the bytes were confirmed present. Null while `pending`. */
    readyAt: timestamp('ready_at', { mode: 'date', withTimezone: true }),
    deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_assets_storage_key').on(table.storageKey),
    index('idx_assets_org').on(table.organizationId, table.createdAt.desc()),
    // The sweep for abandoned uploads: rows that were signed for and never
    // confirmed. Partial, because `ready` rows are the overwhelming majority.
    index('idx_assets_pending')
      .on(table.createdAt)
      .where(sql`${table.status} = 'pending'`),
  ]
);
