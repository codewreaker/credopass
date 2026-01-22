// ============================================================================
// FILE: packages/lib/src/schemas/tables/org-memberships.ts
// Organization memberships - links users to organizations with roles
// ============================================================================

import { pgTable, text, timestamp, index, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { organizations } from './organizations';

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
  
  // Foreign keys
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Role within the organization
  role: text('role', { 
    enum: ['owner', 'admin', 'member', 'viewer'] 
  }).notNull().default('member'),
  
  // Invitation tracking
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
]).enableRLS();

export type OrgMembershipTable = typeof orgMemberships;
