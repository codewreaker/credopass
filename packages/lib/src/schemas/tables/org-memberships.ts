// ============================================================================
// FILE: packages/lib/src/schemas/tables/org-memberships.ts
// An account's role in an organisation. docs/API-FIRST-REBUILD.md §3.2
// ============================================================================

import { pgTable, text, timestamp, index, uuid, unique } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { organizations } from './organizations';
import { orgRole, provisionedBy } from './enums';

/**
 * THE authorization model. References `accounts` only — no identity provider
 * can reach it, which is the whole point of D1: an IdP answers "who is this
 * human?", CredoPass answers "what may they do?".
 *
 * Note what is absent: the old `invitedBy`/`invitedAt`/`acceptedAt` columns.
 * An invitation to someone who does not yet have an account cannot be a
 * membership row — which is exactly why those columns were never wired up.
 * They live in `invitations` now.
 */
export const orgMemberships = pgTable('org_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),

  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  role: orgRole('role').notNull().default('viewer'),
  // Suspending a member must not delete their history.
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),

  // SCIM-ready from day one, so adding it is an endpoint not a migration (D1).
  provisionedBy: provisionedBy('provisioned_by').notNull().default('manual'),
  externalId: text('external_id'),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('uq_org_memberships_org_account').on(table.organizationId, table.accountId),
  // HOT: read on every authenticated request, and again by the RLS helper
  // app.current_org_ids().
  index('idx_org_memberships_account').on(table.accountId),
  index('idx_org_memberships_org_role').on(table.organizationId, table.role),
]).enableRLS();

export type OrgMembershipTable = typeof orgMemberships;
