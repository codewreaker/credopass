// ============================================================================
// FILE: packages/lib/src/schemas/tables/events.ts
// docs/API-FIRST-REBUILD.md §3.2
// ============================================================================

import {
  pgTable, text, timestamp, index, uuid, boolean, integer, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { eventSeries } from './event-series';

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

  /**
   * The recurring programme this is one occurrence of, or null for a one-off.
   *
   * **Always null today — recurring events are PAUSED (2026-11-07).** Kept
   * because the migration is already applied and the column is inert. See
   * `event-series.ts` and docs/RECURRING-EVENTS.md.
   *
   * `ON DELETE SET NULL`, deliberately. Deleting the series must never cascade
   * into the events: those rows carry `attendance` — the durable record that
   * somebody actually turned up — and losing attendance because a programme
   * was tidied away would destroy the one thing this product exists to keep.
   * An orphaned occurrence is simply a one-off event again.
   */
  seriesId: uuid('series_id').references(() => eventSeries.id, { onDelete: 'set null' }),
  /** 0-based position within the series, for "the 3rd of 12" and stable ordering. */
  seriesIndex: integer('series_index'),

  name: text('name').notNull(),
  description: text('description'),

  // Schedule. `end_at` is genuinely NOT NULL — the old "no end time ⇒ assume an
  // hour" rule becomes a write-time default, so no reader ever has to guess.
  startAt: timestamp('start_at', { mode: 'date', withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { mode: 'date', withTimezone: true }).notNull(),
  // IANA zone. Needed for correct display, valid ICS, and DST.
  timezone: text('timezone').notNull().default('UTC'),

  /**
   * Where it happens, in words. NULLABLE since B3/F16: an online event has no
   * address, and the composer has advertised "Offline location or virtual
   * link" since long before the schema allowed it.
   *
   * NULL means "not given", which is not the same as `''`. Nothing writes the
   * empty string — the API coerces a blank field to NULL on the way in, so
   * there is exactly one representation of "no location" to read back.
   */
  locationText: text('location_text'),
  /**
   * The join link for an online or hybrid event (B3/F16). Validated as an
   * absolute http(s) URL at the API boundary, not here.
   *
   * There is deliberately no `format` column. It would have to be kept in
   * step with these two fields on every write, and a stored copy of something
   * derivable is how `status` used to go stale — the same reasoning as D2,
   * which derives event status from the timestamps instead of storing it. The
   * API derives `format` on read; see `deriveEventFormat`.
   */
  meetingUrl: text('meeting_url'),
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

  /**
   * The event's poster, as an absolute URL.
   *
   * Deliberately a URL and not the `cover_asset_id` FK above. That column has
   * existed, unused and pointing at no table, since the first schema; giving it
   * an `assets` table means object storage, presigned uploads, derivatives and
   * compression — a week of work (ROADMAP stage 4).
   *
   * Meanwhile the composer has had a poster slot the whole time that threw the
   * pick away on submit, so no event in the product has ever had an image. One
   * nullable column fixes that today (F14): paste a link, it is stored and
   * rendered everywhere an event appears.
   *
   * Stage 4 replaces what WRITES this column, not the column. An uploaded file
   * gets an `assets` row and this field holds the URL derived from it, so
   * nothing that reads an event has to change twice.
   */
  coverImageUrl: text('cover_image_url'),

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
  // "Show me the rest of this programme" — and the edit-all-future path.
  index('idx_events_series').on(table.seriesId, table.startAt),
  uniqueIndex('uq_events_short_code').on(table.shortCode),
  index('idx_events_org_active').on(table.organizationId).where(sql`${table.deletedAt} IS NULL`),
  // The scheduler's sweep: events past their window that nobody has closed.
  index('idx_events_open').on(table.startAt)
    .where(sql`${table.closedAt} IS NULL AND ${table.cancelledAt} IS NULL`),
]).enableRLS();

export type EventTable = typeof events;
