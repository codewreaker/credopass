// ============================================================================
// FILE: packages/lib/src/schemas/tables/events.ts
// docs/API-FIRST-REBUILD.md §3.2
// ============================================================================

import {
  pgTable, text, timestamp, index, uuid, boolean, integer, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

/**
 * An event.
 *
 * Note what is ABSENT: there is no `status` column and no enum for one. The
 * four statuses the UI renders — scheduled · ongoing · completed · cancelled —
 * are a pure function of `(cancelled_at, closed_at, start_at, end_at, now)`.
 * See EventService.deriveStatus (D2).
 *
 * A status that cannot be stored cannot go stale, which is the bug the old
 * `status` column had: it said `scheduled` for events that had already
 * finished, because a column does not know what time it is.
 */
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  description: text('description'),

  // Schedule. `end_at` is genuinely NOT NULL — the old "no end time ⇒ assume an
  // hour" rule becomes a write-time default, so no reader ever has to guess.
  startAt: timestamp('start_at', { mode: 'date', withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { mode: 'date', withTimezone: true }).notNull(),
  // IANA zone. Needed for correct display, valid ICS, and DST.
  timezone: text('timezone').notNull().default('UTC'),

  locationText: text('location_text').notNull(),
  // Geocoded on WRITE, never on read — the client-side geocoder was returning
  // 403 on every page load and shipping a Mapbox token to the browser (§10.3).
  locationLat: text('location_lat'),
  locationLng: text('location_lng'),
  locationResolvedAt: timestamp('location_resolved_at', { mode: 'date', withTimezone: true }),

  capacity: integer('capacity'),
  // Capacity was stored and displayed but never enforced. Opt-in per event so
  // turning it on is a deliberate act (D-D).
  enforceCapacity: boolean('enforce_capacity').notNull().default(false),

  // The door code the UI shows as `#F6F82EC3-09D`. A real collision-checked
  // value, because it gets read aloud at a door.
  shortCode: text('short_code').notNull(),

  checkInMethods: text('check_in_methods').array().notNull().default(['qr']),
  requireCheckOut: boolean('require_check_out').notNull().default(false),
  allowSelfCheckIn: boolean('allow_self_check_in').notNull().default(true),

  coverAssetId: uuid('cover_asset_id'),

  // The recorded facts that ARE the status (D2).
  openedAt: timestamp('opened_at', { mode: 'date', withTimezone: true }),
  closedAt: timestamp('closed_at', { mode: 'date', withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { mode: 'date', withTimezone: true }),
  cancellationReason: text('cancellation_reason'),

  deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_events_org_start').on(table.organizationId, table.startAt.desc()),
  uniqueIndex('uq_events_short_code').on(table.shortCode),
  index('idx_events_org_active').on(table.organizationId).where(sql`${table.deletedAt} IS NULL`),
  // The scheduler's sweep: events past their window that nobody has closed.
  index('idx_events_open').on(table.startAt)
    .where(sql`${table.closedAt} IS NULL AND ${table.cancelledAt} IS NULL`),
]).enableRLS();

export type EventTable = typeof events;
