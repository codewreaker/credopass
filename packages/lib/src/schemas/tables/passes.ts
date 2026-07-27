// ============================================================================
// FILE: packages/lib/src/schemas/tables/passes.ts
// The attendee's bearer credential. docs/API-FIRST-REBUILD.md §3.2, D12, D17
// ============================================================================

import { pgTable, timestamp, index, uuid, integer, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { events } from './events';
import { organizations } from './organizations';
import { people } from './people';

/**
 * Why this exists at all.
 *
 * The old pass QR encoded `{eventId}:{userId}` — a raw event id and a raw user
 * id, both of which appear in URLs and API responses. Anyone who knew two ids
 * could mint someone else's pass. And the kiosk "validated" it by scanning a
 * client-side user cache, so validity depended on what happened to be in a
 * browser's memory.
 *
 * It is now a signed token: `CP1.{base64url(payload)}.{sig}`, HMAC-SHA256 over
 * `{eventId, personId, exp}` with a per-organisation key.
 *
 * WHY A ROW, rather than a purely stateless signed token: revocation, expiry
 * extension, and "this pass has been viewed 40 times from 40 addresses" all
 * need somewhere to live. Verification is still one indexed lookup on a hash,
 * and the SIGNATURE IS CHECKED FIRST — so an unsigned guess never reaches the
 * database at all (T37).
 *
 * The raw token is never stored. It exists only in the URL that was emailed.
 */
export const passes = pgTable('passes', {
  id: uuid('id').primaryKey().defaultRandom(),

  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),

  // SHA-256 of the token. A database dump does not hand out passes.
  tokenHash: text('token_hash').notNull(),

  issuedAt: timestamp('issued_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  // Default: event end + 24h, so a printed or screenshotted pass never expires
  // while it is still useful.
  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),

  // Abuse signal: a pass viewed from many addresses has been forwarded around.
  lastViewedAt: timestamp('last_viewed_at', { mode: 'date', withTimezone: true }),
  viewCount: integer('view_count').notNull().default(0),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_passes_token_hash').on(table.tokenHash),
  // One live pass per person per event; revoked ones do not block reissuing.
  uniqueIndex('uq_passes_event_person_live')
    .on(table.eventId, table.personId)
    .where(sql`${table.revokedAt} IS NULL`),
  index('idx_passes_person').on(table.personId),
]).enableRLS();

export type PassTable = typeof passes;
