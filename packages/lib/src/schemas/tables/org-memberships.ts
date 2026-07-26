// ============================================================================
// FILE: packages/lib/src/schemas/tables/org-memberships.ts
// Organization memberships - links users to organizations with roles
// ============================================================================

import { pgTable, text, timestamp, index, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { accounts } from './accounts';
import { organizations } from './organizations';
import { provisionedBy } from './enums';

/**
 * Org memberships define which users belong to which organizations
 * and what role they have within that organization.
 * 
 * Roles:
 * - owner: Full control, billing, can delete org
 * - admin: Can manage events, members, settings (not billing)
 * - member: Can create events, check-in members
 * - viewer: Read-only access to attendance data
 */
export const orgMemberships = pgTable('org_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign keys.
  //
  // `userId` became NULLABLE in Phase 1: a membership now belongs to an
  // `account`, and new memberships have no `users` row at all. Existing rows
  // keep theirs until Phase 3 drops the column.
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Role within the organization.
  //
  // `organizer` and `checkin` are the Phase 1 vocabulary (§6.2). `member` is
  // retained ONLY so existing rows still validate; nothing writes it any more,
  // and IdentityService.normaliseRole maps it to `organizer` on read. It goes
  // when the column becomes a real org_role enum in Phase 3.
  role: text('role', {
    enum: ['owner', 'admin', 'organizer', 'checkin', 'viewer', 'member'],
  }).notNull().default('viewer'),
  
  // --------------------------------------------------------------------------
  // Rebuild columns (Phase 1). Additive: the legacy columns above stay until
  // Phase 3 so the change is revertible. docs/API-FIRST-REBUILD.md §3.2.
  // --------------------------------------------------------------------------

  // The authorization model references ACCOUNTS only — no identity provider can
  // reach it (D1). Nullable during the transition; it becomes the sole subject
  // of a membership once `userId` is dropped.
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),

  // Suspending a member must not delete their history or their attendance.
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),

  // SCIM-ready from day one, so adding it later is an endpoint not a migration.
  provisionedBy: provisionedBy('provisioned_by').notNull().default('manual'),
  // The IdP's own id for this membership — SCIM's join key.
  externalId: text('external_id'),

  // --------------------------------------------------------------------------
  // DEPRECATED (Phase 3 drops these). An invitation to someone who does not yet
  // have an account cannot be a membership row, which is exactly why these have
  // never been wired up. Superseded by the `invitations` table.
  // --------------------------------------------------------------------------
  invitedBy: uuid('invitedBy').references(() => users.id, { onDelete: 'set null' }),
  invitedAt: timestamp('invitedAt', { mode: 'date', withTimezone: true }),
  acceptedAt: timestamp('acceptedAt', { mode: 'date', withTimezone: true }),

  // Timestamps
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // User can only have one membership per organization
  unique('uq_org_memberships_user_org').on(table.userId, table.organizationId),
  index('idx_org_memberships_userId').on(table.userId),
  index('idx_org_memberships_organizationId').on(table.organizationId),
  index('idx_org_memberships_role').on(table.role),
  // HOT: read on every single authenticated request to resolve the caller's
  // organisations, and again by the RLS helper app.current_org_ids().
  index('idx_org_memberships_account_id').on(table.accountId),
  index('idx_org_memberships_org_role').on(table.organizationId, table.role),
]).enableRLS();

export type OrgMembershipTable = typeof orgMemberships;
