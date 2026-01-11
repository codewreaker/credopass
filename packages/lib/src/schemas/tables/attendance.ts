// ============================================================================
// FILE: packages/lib/src/schemas/tables/attendance.ts
// Attendance table definition for Drizzle ORM (PostgreSQL)
// ============================================================================

import { pgTable, boolean, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { events } from './events';

export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('eventId').notNull().references(() => events.id, { onDelete: 'cascade' }),
  patronId: uuid('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attended: boolean('attended').notNull().default(false),
  checkInTime: timestamp('checkInTime', { mode: 'date', withTimezone: true }),
  checkOutTime: timestamp('checkOutTime', { mode: 'date', withTimezone: true }),
}, (table) => [
  index('idx_attendance_eventId').on(table.eventId),
  index('idx_attendance_patronId').on(table.patronId),
  index('idx_attendance_attended').on(table.attended),
  index('idx_attendance_unique').on(table.eventId, table.patronId),
]);

export type AttendanceTable = typeof attendance;
