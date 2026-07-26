// ============================================================================
// FILE: packages/lib/src/schemas/tables/invitations.ts
// Inviting someone who does not yet have an account. (D-B)
// docs/API-FIRST-REBUILD.md §3.2
// ============================================================================

import { pgTable, text, timestamp, index, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { organizations } from './organizations';
import { orgRole } from './enums';

/**
 * Why this is a table and not columns on `org_memberships`.
 *
 * `org_memberships` currently carries invitedBy/invitedAt/acceptedAt, and they
 * have never been wired up — because they cannot be. A membership row needs an
 * account, and the whole point of an invitation is that the recipient may not
 * have one yet. The invitation is addressed to an EMAIL; the membership is
 * created when it is accepted.
 *
 * The token is emailed and never stored — only its SHA-256. A leaked database
 * dump therefore does not hand out org access.
 */
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),

  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  email: text('email').notNull(),
  role: orgRole('role').notNull(),

  // SHA-256 of the emailed token. Compared, never displayed.
  tokenHash: text('token_hash').notNull(),

  invitedByAccountId: uuid('invited_by_account_id').references(() => accounts.id, { onDelete: 'set null' }),

  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { mode: 'date', withTimezone: true }),
  revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // One live invitation per (org, email). Accepted and revoked ones don't block
  // re-inviting.
  uniqueIndex('uq_invitations_org_email_pending')
    .on(table.organizationId, sql`lower(${table.email})`)
    .where(sql`${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL`),

  index('idx_invitations_token_hash').on(table.tokenHash),
  index('idx_invitations_organization_id').on(table.organizationId),
]).enableRLS();

export type InvitationTable = typeof invitations;
