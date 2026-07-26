// ============================================================================
// FILE: packages/lib/src/schemas/tables/people.ts
// A tenant-scoped attendee record. THE keystone change.
// docs/API-FIRST-REBUILD.md §3.2, D17
// ============================================================================

import { pgTable, text, timestamp, index, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { organizations } from './organizations';

/**
 * Why this table is the keystone.
 *
 * Today `users.email` is GLOBALLY unique. Two churches cannot both have
 * john@gmail.com on their rolls: the first one to check him in owns the row,
 * and the second one's check-in silently attaches to a person the first org can
 * read. Tenant-scoping that uniqueness is not an optimisation — it is the
 * difference between a multi-tenant product and a shared spreadsheet (T20).
 *
 * `account_id` is the hinge of the two-scope model:
 *
 *   · Org-scoped reads NEVER look at it. They filter on organization_id.
 *   · Personal reads (GET /me/tickets) look at ONLY it, across every org.
 *
 * One column, two entirely separate access paths, neither able to reach the
 * other's rows. It is set by CLAIMING a verified email (D17) — never by
 * registering, because registering for an event must not link you to anything.
 */
export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),

  // The tenant column.
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Set when this person also signs in. ON DELETE SET NULL: deleting an account
  // must not delete an organisation's attendance history.
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),

  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  avatarAssetId: uuid('avatar_asset_id'),
  notes: text('notes'),

  // Soft delete — attendance history must survive removing someone from a roll.
  deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Per-org, case-insensitive, ignoring soft-deleted rows. THE fix for T20.
  uniqueIndex('uq_people_org_email')
    .on(table.organizationId, sql`lower(${table.email})`)
    .where(sql`${table.email} IS NOT NULL AND ${table.deletedAt} IS NULL`),

  index('idx_people_org_name').on(table.organizationId, table.lastName, table.firstName),
  // The personal-scope path.
  index('idx_people_account_id').on(table.accountId),
  index('idx_people_org_active').on(table.organizationId).where(sql`${table.deletedAt} IS NULL`),
]).enableRLS();

export type PersonTable = typeof people;
