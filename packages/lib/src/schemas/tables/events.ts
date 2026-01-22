// ============================================================================
// FILE: packages/lib/src/schemas/tables/events.ts
// Events table definition for Drizzle ORM (PostgreSQL)
// ============================================================================

import { pgTable, text, integer, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Organization ownership (multi-tenancy)
  organizationId: uuid('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Event details
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'] 
  }).notNull().default('draft'),
  
  // Check-in configuration
  checkInMethods: text('checkInMethods').array().notNull().default(['qr']), // ['qr', 'manual', 'external_auth']
  requireCheckOut: text('requireCheckOut').notNull().default('false'), // Track check-out times
  
  // Schedule
  startTime: timestamp('startTime', { mode: 'date', withTimezone: true }).notNull(),
  endTime: timestamp('endTime', { mode: 'date', withTimezone: true }).notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity'),
  
  // Soft delete support
  deletedAt: timestamp('deletedAt', { mode: 'date', withTimezone: true }),
  
  // Timestamps
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_events_organizationId').on(table.organizationId),
  index('idx_events_status').on(table.status),
  index('idx_events_startTime').on(table.startTime),
  index('idx_events_deletedAt').on(table.deletedAt),
]);

export type EventTable = typeof events;
