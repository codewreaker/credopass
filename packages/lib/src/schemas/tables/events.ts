// ============================================================================
// FILE: packages/lib/src/schemas/tables/events.ts
// Events table definition for Drizzle ORM (PostgreSQL)
// ============================================================================

import { pgTable, text, integer, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'] 
  }).notNull(),
  startTime: timestamp('startTime', { mode: 'date', withTimezone: true }).notNull(),
  endTime: timestamp('endTime', { mode: 'date', withTimezone: true }).notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity'),
  hostId: uuid('hostId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_events_status').on(table.status),
  index('idx_events_hostId').on(table.hostId),
  index('idx_events_startTime').on(table.startTime),
]);

export type EventTable = typeof events;
