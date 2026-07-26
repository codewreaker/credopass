// ============================================================================
// FILE: packages/lib/src/schemas/tables/device-tokens.ts
// A scoped credential for a door tablet. docs/API-FIRST-REBUILD.md §3.2, D9
// ============================================================================

import { pgTable, text, timestamp, index, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { events } from './events';
import { organizations } from './organizations';

/**
 * Why this exists.
 *
 * A tablet propped by a door is the least physically secure thing in the
 * system, and until now it carried the same credential as the owner's laptop —
 * the kiosk ran inside the authenticated console, so whoever walked off with
 * the tablet had the whole organisation.
 *
 * A device token is deliberately narrow: one event, an explicit scope list,
 * an expiry, and revocable from the console without touching anyone's password.
 *
 * The token itself is never stored — only its SHA-256. The `pairing_code` is
 * the short, human-typeable half of the flow: an admin generates one on the
 * event page and reads it to whoever is setting up the tablet. It is
 * single-use and short-lived, because a code someone can read aloud is a code
 * someone else can overhear.
 */
export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),

  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  // NULL = an org-wide kiosk. Set = this token works on ONE event and no other.
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),

  label: text('label').notNull(),

  // SHA-256 of the bearer token. Null until the device has paired — the token
  // does not exist before then, so there is nothing to hash.
  tokenHash: text('token_hash'),

  // Short, unambiguous, single-use, expires in minutes. Cleared once redeemed.
  pairingCode: text('pairing_code'),
  pairingExpiresAt: timestamp('pairing_expires_at', { mode: 'date', withTimezone: true }),
  pairedAt: timestamp('paired_at', { mode: 'date', withTimezone: true }),

  /**
   * What this device may do. An INTERSECTION with the role's permissions, never
   * additive — a scope naming something the role lacks grants nothing (§6.3).
   */
  scopes: text('scopes').array().notNull().default(['attendance:record', 'attendance:read', 'event:read']),

  issuedByAccountId: uuid('issued_by_account_id').references(() => accounts.id, { onDelete: 'set null' }),

  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_device_tokens_token_hash').on(table.tokenHash).where(sql`${table.tokenHash} IS NOT NULL`),
  // A pairing code must be unique only while it is claimable.
  uniqueIndex('uq_device_tokens_pairing_code').on(table.pairingCode).where(sql`${table.pairingCode} IS NOT NULL`),
  index('idx_device_tokens_org').on(table.organizationId),
  index('idx_device_tokens_event').on(table.eventId),
]).enableRLS();

export type DeviceTokenTable = typeof deviceTokens;
