// ============================================================================
// FILE: packages/lib/src/schemas/tables/event-members.ts
// Event members - allows multiple users to manage an event with different roles
// ============================================================================

import { pgTable, text, timestamp, index, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { events } from './events';

/**
 * Event members replace the single hostId relationship.
 * This allows multiple people to manage an event with different roles.
 * 
 * Roles:
 * - organizer: Primary event owner, full control
 * - co-host: Can manage event, check-in, edit details
 * - staff: Can check-in attendees
 * - volunteer: Limited check-in capabilities
 */
export const eventMembers = pgTable('event_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign keys
  eventId: uuid('eventId').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Role within the event
  role: text('role', { 
    enum: ['organizer', 'co-host', 'staff', 'volunteer'] 
  }).notNull().default('staff'),
  
  // Timestamps
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // User can only have one role per event
  unique('uq_event_members_event_user').on(table.eventId, table.userId),
  index('idx_event_members_eventId').on(table.eventId),
  index('idx_event_members_userId').on(table.userId),
  index('idx_event_members_role').on(table.role),
]).enableRLS();

export type EventMemberTable = typeof eventMembers;
