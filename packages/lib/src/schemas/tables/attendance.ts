// ============================================================================
// FILE: packages/lib/src/schemas/tables/attendance.ts
// Attendance table definition for Drizzle ORM (PostgreSQL)
// ============================================================================

import { pgTable, boolean, timestamp, index, uuid, unique, text } from 'drizzle-orm/pg-core';
import { users } from './users';
import { events } from './events';
import { organizations } from './organizations';

export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Organization for direct tenant filtering (denormalized from event)
  organizationId: uuid('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Event and patron
  eventId: uuid('eventId').notNull().references(() => events.id, { onDelete: 'cascade' }),
  patronId: uuid('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Attendance status
  attended: boolean('attended').notNull().default(false),
  checkInTime: timestamp('checkInTime', { mode: 'date', withTimezone: true }),
  checkOutTime: timestamp('checkOutTime', { mode: 'date', withTimezone: true }),
  
  // Check-in method used
  checkInMethod: text('checkInMethod', {
    enum: ['qr', 'manual', 'external_auth']
  }),
  
  // Optional notes (e.g., "arrived late", "left early")
  notes: text('notes'),
}, (table) => [
  // Patron can only have one attendance record per event
  unique('uq_attendance_event_patron').on(table.eventId, table.patronId),
  index('idx_attendance_organizationId').on(table.organizationId),
  index('idx_attendance_eventId').on(table.eventId),
  index('idx_attendance_patronId').on(table.patronId),
  index('idx_attendance_attended').on(table.attended),
  index('idx_attendance_checkInTime').on(table.checkInTime),
]);

export type AttendanceTable = typeof attendance;
