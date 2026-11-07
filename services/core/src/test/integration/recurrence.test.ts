/**
 * Recurring events against a real Postgres. ROADMAP stage 3, D40.
 *
 * The expansion arithmetic is unit-tested in `src/test/recurrence.test.ts`.
 * What needs a database is everything that only shows up when rows are
 * actually written: that the occurrences exist as real events, that they are
 * one transaction, that short codes do not collide across a 104-row batch,
 * that tenancy holds, and — the one that matters most — that deleting the
 * series does not take the attendance with it.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import * as Events from '../../services/event';
import { createTenantContext, type TenantContext } from '../../tenancy/context';
import { eventSeries, events, organizations } from '@credopass/lib/schemas/tables';
import { eq } from 'drizzle-orm';

const ACTOR = '99999999-9999-9999-9999-999999999999';
const HOUR = 3_600_000;

let harness: TestDatabase;
let db: any;
let ctxA: TenantContext;
let ctxB: TenantContext;
let orgA: string;

beforeAll(async () => {
  process.env.PASS_SIGNING_KEY ??= 'test-signing-key-not-for-production';
  harness = await getTestDatabase();
  db = harness.db;
});

beforeEach(async () => {
  await harness.reset();
  const [a] = await db
    .insert(organizations)
    .values({ name: 'A', slug: `a-${crypto.randomUUID().slice(0, 8)}` })
    .returning({ id: organizations.id });
  const [b] = await db
    .insert(organizations)
    .values({ name: 'B', slug: `b-${crypto.randomUUID().slice(0, 8)}` })
    .returning({ id: organizations.id });
  orgA = a.id;
  ctxA = createTenantContext({ organizationId: a.id, accountId: ACTOR, role: 'owner' });
  ctxB = createTenantContext({ organizationId: b.id, accountId: ACTOR, role: 'owner' });
});

afterAll(async () => {
  await harness.stop();
});

const START = new Date('2026-03-22T10:00:00Z');

/** A weekly series running for `weeks` occurrences, expressed as an end date. */
const weekly = (weeks: number) => ({
  name: 'Sunday Morning Service',
  startAt: START,
  locationText: 'Main hall',
  timezone: 'Europe/London',
  recurrence: {
    frequency: 'weekly' as const,
    until: new Date(START.getTime() + (weeks - 1) * 7 * 24 * HOUR),
  },
});

describe('createEvent with recurrence', () => {
  it('writes one series and one real event per occurrence', async () => {
    await Events.createEvent(db, ctxA, weekly(12));

    const series = await db.select().from(eventSeries).where(eq(eventSeries.organizationId, orgA));
    expect(series).toHaveLength(1);
    expect(series[0].rrule).toMatch(/^FREQ=WEEKLY;BYDAY=SU;UNTIL=\d{8}T\d{6}Z$/);
    expect(series[0].occurrenceCount).toBe(12);

    const rows = await db.select().from(events).where(eq(events.seriesId, series[0].id));
    expect(rows).toHaveLength(12);
    // Every occurrence is a FULL event — these are the columns attendance,
    // passes and the kiosk all depend on.
    for (const row of rows) {
      expect(row.shortCode).toBeTruthy();
      expect(row.name).toBe('Sunday Morning Service');
      expect(row.locationText).toBe('Main hall');
      expect(row.organizationId).toBe(orgA);
    }
  });

  it('returns the first occurrence, so the response shape is unchanged', async () => {
    const created = await Events.createEvent(db, ctxA, weekly(5));
    expect(created.seriesIndex).toBe(0);
    expect(created.seriesId).toBeTruthy();
    expect(new Date(created.startAt).toISOString()).toBe('2026-03-22T10:00:00.000Z');
  });

  it('indexes occurrences contiguously from zero', async () => {
    await Events.createEvent(db, ctxA, weekly(8));
    const rows = await db.select().from(events);
    expect(rows.map((r: any) => r.seriesIndex).sort((x: number, y: number) => x - y)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('keeps the wall-clock time across a DST boundary, in the database', async () => {
    await Events.createEvent(db, ctxA, weekly(3));
    const rows = await db.select().from(events).orderBy(events.startAt);
    // 10:00 Europe/London: 10:00Z before BST, 09:00Z after.
    expect(rows[0].startAt.toISOString()).toBe('2026-03-22T10:00:00.000Z');
    expect(rows[1].startAt.toISOString()).toBe('2026-03-29T09:00:00.000Z');
    expect(rows[2].startAt.toISOString()).toBe('2026-04-05T09:00:00.000Z');
  });

  it('gives every occurrence a distinct short code', async () => {
    // The batch is allocated before the insert, so codes must not collide with
    // each other as well as with the table. uq_events_short_code would reject
    // the whole insert if they did.
    await Events.createEvent(db, ctxA, weekly(40));
    const rows = await db.select({ code: events.shortCode }).from(events);
    expect(new Set(rows.map((r: any) => r.code)).size).toBe(40);
  });

  it('caps the horizon however far away the end date is', async () => {
    // "Every week until 2099" is a legitimate thing to ask for and an
    // illegitimate thing to write: each occurrence is a real row.
    await Events.createEvent(db, ctxA, {
      ...weekly(2),
      recurrence: { frequency: 'weekly' as const, until: new Date('2099-01-01T00:00:00Z') },
    });
    const rows = await db.select().from(events);
    expect(rows).toHaveLength(104);
  });

  it('includes an occurrence falling on the end date itself', async () => {
    // Inclusive: "until 5 April" includes the 5th.
    await Events.createEvent(db, ctxA, {
      ...weekly(2),
      recurrence: { frequency: 'weekly' as const, until: new Date('2026-04-05T00:00:00Z') },
    });
    const rows = await db.select().from(events).orderBy(events.startAt);
    expect(rows).toHaveLength(3);
    expect(rows[2].startAt.toISOString()).toBe('2026-04-05T09:00:00.000Z');
  });

  it('still creates the first event when the end date is before it', async () => {
    // The organiser explicitly scheduled this event; contradictory repeat
    // settings must not make it vanish.
    await Events.createEvent(db, ctxA, {
      ...weekly(2),
      recurrence: { frequency: 'weekly' as const, until: new Date('2020-01-01T00:00:00Z') },
    });
    expect(await db.select().from(events)).toHaveLength(1);
  });

  it('creates nothing at all when the input is invalid', async () => {
    // One transaction: a rejected end time must not leave a series with a
    // partial set of weeks behind it.
    await expect(
      Events.createEvent(db, ctxA, {
        ...weekly(6),
        endAt: new Date('2026-03-22T09:00:00Z'), // before the start
      })
    ).rejects.toThrow();

    expect(await db.select().from(eventSeries)).toHaveLength(0);
    expect(await db.select().from(events)).toHaveLength(0);
  });

  it('creates a single event when no recurrence is given', async () => {
    const created = await Events.createEvent(db, ctxA, {
      name: 'One-off',
      startAt: new Date('2026-03-22T10:00:00Z'),
      locationText: 'Main hall',
    });
    expect(created.seriesId).toBeNull();
    expect(created.seriesIndex).toBeNull();
    expect(await db.select().from(eventSeries)).toHaveLength(0);
    expect(await db.select().from(events)).toHaveLength(1);
  });
});

describe('tenancy', () => {
  it('does not show another tenant the occurrences', async () => {
    await Events.createEvent(db, ctxA, weekly(6));
    const seen = await Events.listEvents(db, ctxB, {});
    expect(seen.data).toHaveLength(0);
  });
});

describe('deleting the series', () => {
  it('leaves the occurrences standing, because they carry the attendance', async () => {
    // ON DELETE SET NULL, not CASCADE. Losing attendance records because a
    // programme was tidied away would destroy the one thing this product
    // exists to keep. An orphaned occurrence is just a one-off again.
    await Events.createEvent(db, ctxA, weekly(4));
    const [series] = await db.select().from(eventSeries);

    await db.delete(eventSeries).where(eq(eventSeries.id, series.id));

    const rows = await db.select().from(events);
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.seriesId).toBeNull();
  });
});
