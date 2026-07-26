// ============================================================================
// FILE: packages/lib/src/schemas/tables/events.ts
// Events table definition for Drizzle ORM (PostgreSQL)
// ============================================================================

import { pgTable, text, integer, timestamp, index, uuid, boolean } from 'drizzle-orm/pg-core';
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
  requireCheckOut: boolean('requireCheckOut').notNull().default(false), // Track check-out times
  // When true, attendees may check themselves in from the public event page
  // (their pass QR flips attended=true). When false, only a staff scan / manual
  // check-in at the kiosk can mark them attended — self check-in just registers.
  allowSelfCheckIn: boolean('allowSelfCheckIn').notNull().default(true),
  
  // Schedule
  startTime: timestamp('startTime', { mode: 'date', withTimezone: true }).notNull(),
  endTime: timestamp('endTime', { mode: 'date', withTimezone: true }).notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity'),
  
  // --------------------------------------------------------------------------
  // Status as recorded FACTS, not a stored label (Phase 2, D2).
  //
  // The four statuses the UI renders — scheduled · ongoing · completed ·
  // cancelled — are a pure function of these three columns plus the clock. See
  // EventService.deriveStatus. A status that cannot be stored cannot go stale,
  // which is the bug the `status` column above has today.
  //
  // `status` is retained until Phase 3 so /api/core keeps working; nothing in
  // /api/v1/core reads it.
  // --------------------------------------------------------------------------

  // Set when the doors open. Informational — does not affect derived status.
  openedAt: timestamp('opened_at', { mode: 'date', withTimezone: true }),
  // Set by the scheduler past the window, or manually. Forces `completed`, and
  // is the trigger for no-show finalisation.
  closedAt: timestamp('closed_at', { mode: 'date', withTimezone: true }),
  // Wins over everything, including a past event: an organiser needs to see
  // WHY it didn't happen. Doubles as the audit fact of when.
  cancelledAt: timestamp('cancelled_at', { mode: 'date', withTimezone: true }),
  cancellationReason: text('cancellation_reason'),

  // Capacity is stored and displayed today but never enforced (D-D). Opt-in
  // per event, so enabling it is a deliberate act and nothing changes until then.
  enforceCapacity: boolean('enforce_capacity').notNull().default(false),

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
]).enableRLS();

export type EventTable = typeof events;
