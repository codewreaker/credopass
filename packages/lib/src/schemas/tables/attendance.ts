// ============================================================================
// FILE: packages/lib/src/schemas/tables/attendance.ts
// The real record: one row per (event, person). docs/API-FIRST-REBUILD.md §3.2
// ============================================================================

import { pgTable, timestamp, index, uuid, unique, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { events } from './events';
import { organizations } from './organizations';
import { people } from './people';
import { attendanceState, checkInMethod } from './enums';

/**
 * Attendance is not a UI flag. `events.check_in_methods` configures WHICH
 * check-in UI a door shows; this row is the durable fact that someone was
 * there.
 *
 * `state` replaces the old `attended` boolean AND the render-time no-show
 * inference. A no-show used to be computed in the browser as "registered, and
 * the event looks finished" — so it was not a recorded fact, could not be
 * corrected, and could not be audited. Now it is written once when the event
 * closes (D-E).
 */
export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Denormalised from the event, deliberately: it turns the RLS policy into a
  // single column comparison instead of a join, and that policy runs per row.
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),

  state: attendanceState('state').notNull().default('registered'),

  registeredAt: timestamp('registered_at', { mode: 'date', withTimezone: true }),
  checkInTime: timestamp('check_in_time', { mode: 'date', withTimezone: true }),
  checkOutTime: timestamp('check_out_time', { mode: 'date', withTimezone: true }),
  checkInMethod: checkInMethod('check_in_method'),

  // The audit trail the brief asks for: who checked this person in, and when.
  // There was a `checked_in_by_device_id` beside this, recording which paired
  // tablet did it. Doors are staffed by people holding the `checkin` role now
  // (D24), so the account id answers it on its own.
  checkedInByAccountId: uuid('checked_in_by_account_id').references(() => accounts.id, { onDelete: 'set null' }),

  notes: text('notes'),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // One row per person per event, enforced by the DATABASE — not by a cache
  // read in a browser, which is how the current kiosk decides.
  unique('uq_attendance_event_person').on(table.eventId, table.personId),
  index('idx_attendance_event_state').on(table.eventId, table.state),
  index('idx_attendance_person_state').on(table.personId, table.state),
  index('idx_attendance_org_checkin').on(table.organizationId, table.checkInTime.desc()),
  // The live counter on the kiosk.
  index('idx_attendance_attended').on(table.eventId).where(sql`${table.state} = 'attended'`),
]).enableRLS();

export type AttendanceTable = typeof attendance;
