// ============================================================================
// FILE: packages/lib/src/schemas/tables/event-grants.ts
// Delegating MANAGEMENT of one event. docs/API-FIRST-REBUILD.md §3.2
// ============================================================================

import { pgTable, timestamp, index, uuid, unique } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { events } from './events';
import { organizations } from './organizations';
import { eventRole } from './enums';

/**
 * Replaces `event_members`, and narrows it — which matters.
 *
 * `event_members` was doing two unrelated jobs: delegating management of an
 * event, and recording that a person signed up. The attendees page read it as
 * sign-ups while the API and its own comments described it as roles.
 *
 * This table keeps ONLY the delegation job. **A sign-up is an `attendance` row
 * with `state = 'registered'`** — which is what the public flow already writes.
 *
 * A grant ADDS permissions on one event; it never removes org-level ones (§6.3).
 */
export const eventGrants = pgTable('event_grants', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Denormalised for RLS — one column comparison rather than a join.
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // References ACCOUNTS: delegation is about who may sign in and manage, not
  // about who attends.
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  role: eventRole('role').notNull(),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('uq_event_grants_event_account').on(table.eventId, table.accountId),
  index('idx_event_grants_account').on(table.accountId),
  index('idx_event_grants_org').on(table.organizationId),
]).enableRLS();

export type EventGrantTable = typeof eventGrants;
