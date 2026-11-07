// ============================================================================
// FILE: packages/lib/src/schemas/tables/event-series.ts
// ROADMAP.md stage 3 · D40
// ============================================================================

import { pgTable, text, timestamp, index, uuid, integer } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

/**
 * A recurring programme — "every Sunday", "the Tuesday course, six weeks".
 *
 * **The rule is a record, not the source of truth. The occurrences are real
 * `events` rows.** (D40.)
 *
 * This is the decision the whole feature turns on, so it is worth stating
 * plainly. The tempting design is to store an RRULE and expand it at read
 * time: one row, no backfill, no horizon to manage. It does not work here,
 * because every single thing this product does hangs off `events.id`:
 *
 *   · `attendance` is unique on `(event_id, person_id)` — the durable record
 *     that somebody turned up. The point of CredoPass.
 *   · `passes` is unique on `(event_id, person_id) WHERE revoked_at IS NULL`.
 *   · capacity, the short code, check-in state, analytics.
 *
 * A computed occurrence has no id, so the first time anyone checks in to "the
 * third Sunday" there is nothing to write the row against — and you cannot
 * invent the id at check-in time without it differing between two doors.
 * Luma, Eventbrite and Google Calendar all materialise, for this reason.
 *
 * So: creating a recurring event writes the series AND its occurrences in one
 * transaction. This table exists to answer "what was asked for" and "what do
 * I edit when I mean *all* of them" — not to be expanded on read.
 */
export const eventSeries = pgTable(
  'event_series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    /** What the occurrences are called. Each event copies it at creation and can diverge. */
    name: text('name').notNull(),

    /**
     * IANA zone the recurrence is reckoned in.
     *
     * Not decoration: "every Sunday at 10am" means 10am *local*, and across a
     * DST boundary that is a different UTC instant. Expanding in UTC moves a
     * service by an hour twice a year.
     */
    timezone: text('timezone').notNull().default('UTC'),

    /**
     * RFC 5545 RRULE, as the organiser asked for it, e.g.
     * `FREQ=WEEKLY;BYDAY=SU;COUNT=12`.
     *
     * Stored for the record and for regenerating a longer horizon later. It is
     * NOT read to answer "what events are there" — the rows are.
     */
    rrule: text('rrule').notNull(),

    /** First occurrence. The rest are reckoned from here. */
    startsAt: timestamp('starts_at', { mode: 'date', withTimezone: true }).notNull(),

    /**
     * How far the rows have actually been written.
     *
     * A series is materialised to a horizon, not to infinity, so this is the
     * answer to "is there anything left to generate?". A top-up job belongs to
     * the Phase 4 scheduler; until then a horizon buys a year and this column
     * is what tells the next person where it stopped.
     */
    materialisedThrough: timestamp('materialised_through', { mode: 'date', withTimezone: true }).notNull(),

    /** How many occurrences exist. Cheap to read, and a sanity check on the rows. */
    occurrenceCount: integer('occurrence_count').notNull().default(0),

    /** Soft delete, like organizations and events — the occurrences outlive it. */
    deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_event_series_org').on(table.organizationId)]
);
