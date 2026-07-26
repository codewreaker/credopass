// ============================================================================
// FILE: packages/lib/src/schemas/tables/accounts.ts
// An account is a human who can sign in. Ours, not any provider's.
// docs/API-FIRST-REBUILD.md §3.2, D1
// ============================================================================

import { pgTable, text, timestamp, index, uuid, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Half of the keystone change: `users` splits into `accounts` (identity) and
 * `people` (tenant-scoped attendee records).
 *
 * An account is a person who signs IN. It has no organization — it reaches
 * organizations through `org_memberships`, and it reaches its own attendee
 * records through `people.account_id`. Those two paths are separate on purpose:
 * that separation is what makes "attending an event never grants access to the
 * organisation running it" structurally true rather than a rule someone has to
 * remember (§1.1 rule 6).
 *
 * Note the columns that are NOT here: no organizationId, no role, no plan. An
 * account is not a member of anything by virtue of existing.
 *
 * New tables use snake_case column names — a deliberate break from the older
 * tables' quoted "camelCase", which forces quoting in every hand-written SQL
 * statement and every RLS policy (§3.2).
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Nullable: an anonymous guest has no email until they upgrade (D16).
  email: text('email'),

  displayName: text('display_name'),
  avatarAssetId: uuid('avatar_asset_id'),

  // A guest account is created lazily, on first write — never on token
  // verification alone (D16). `/upgrade` converts it by attaching a real
  // identity.
  isGuest: boolean('is_guest').notNull().default(false),

  locale: text('locale'),
  // IANA zone. Drives ICS output and how times are displayed to this human.
  timezone: text('timezone'),

  lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true }),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Case-insensitive and partial: two accounts may both have NULL email
  // (anonymous guests), but no two may share an address.
  uniqueIndex('uq_accounts_email').on(sql`lower(${table.email})`).where(sql`${table.email} IS NOT NULL`),
  index('idx_accounts_last_seen_at').on(table.lastSeenAt),
]).enableRLS();

export type AccountTable = typeof accounts;
