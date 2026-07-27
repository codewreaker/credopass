/**
 * Phase 2 read paths against a real Postgres.
 *
 * The point is the values the client currently computes for itself: derived
 * status, the upcoming/past split, counts, standing, lifetime attendance.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import * as Events from '../../services/event';
import * as People from '../../services/people';
import { createTenantContext, type TenantContext } from '../../tenancy/context';
import { attendance, events, organizations, people } from '@credopass/lib/schemas/tables';

// Any account works: these contexts are built by hand to exercise scoping,
// not membership. `null` used to be legal here because a device caller had no
// account; with device tokens gone every tenant context has one (D24).
const ACTOR = '99999999-9999-9999-9999-999999999999';

let harness: TestDatabase;
let db: any;
let ctxA: TenantContext;
let orgA: string;
let orgB: string;

const HOUR = 3_600_000;
const NOW = new Date('2026-08-01T12:00:00Z');

const makeOrg = async (name: string, slug: string): Promise<string> => {
  const [org] = await db.insert(organizations).values({ name, slug }).returning({ id: organizations.id });
  return org.id;
};

const makeEvent = async (
  organizationId: string,
  name: string,
  startAt: Date,
  extra: Record<string, unknown> = {}
) => {
  const [e] = await db
    .insert(events)
    .values({
      organizationId,
      name,
      startAt,
      endAt: new Date(startAt.getTime() + HOUR),
      locationText: 'Hall',
      shortCode: crypto.randomUUID().slice(0, 12),
      ...extra,
    })
    .returning({ id: events.id });
  return e.id;
};

const makePerson = async (organizationId: string, firstName: string, lastName: string) => {
  const email = `${firstName}.${lastName}.${crypto.randomUUID().slice(0, 6)}@x.com`.toLowerCase();
  const [p] = await db
    .insert(people)
    .values({ organizationId, firstName, lastName, email })
    .returning({ id: people.id });
  return p.id;
};

beforeAll(async () => {
  harness = await getTestDatabase();
  db = harness.db;
});

beforeEach(async () => {
  await harness.reset();
  orgA = await makeOrg('Org A', `a-${crypto.randomUUID().slice(0, 8)}`);
  orgB = await makeOrg('Org B', `b-${crypto.randomUUID().slice(0, 8)}`);
  ctxA = createTenantContext({ organizationId: orgA, accountId: ACTOR, role: 'owner' });
});

afterAll(async () => {
  await harness.stop();
});

describe('listEvents', () => {
  it('returns only the caller\'s organization (T1)', async () => {
    await makeEvent(orgA, 'A event', new Date(NOW.getTime() + HOUR));
    await makeEvent(orgB, 'B event', new Date(NOW.getTime() + HOUR));

    const { data } = await Events.listEvents(db, ctxA, {}, NOW);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('A event');
    expect(data[0].organizationName).toBe('Org A');
  });

  it('derives status rather than reading a column', async () => {
    await makeEvent(orgA, 'Future', new Date(NOW.getTime() + 24 * HOUR));
    await makeEvent(orgA, 'Live', new Date(NOW.getTime() - 0.5 * HOUR));
    await makeEvent(orgA, 'Done', new Date(NOW.getTime() - 24 * HOUR));

    const { data } = await Events.listEvents(db, ctxA, {}, NOW);
    const byName = Object.fromEntries(data.map((e) => [e.name, e.status]));

    expect(byName.Future).toBe('scheduled');
    expect(byName.Live).toBe('ongoing');
    expect(byName.Done).toBe('completed');
  });

  it('puts a CANCELLED FUTURE event in `past` — not `upcoming`', async () => {
    // The rule a naive `startTime < now()` filter gets wrong. It is not going
    // to happen, so it does not belong in "upcoming".
    await makeEvent(orgA, 'Called off', new Date(NOW.getTime() + 48 * HOUR), {
      cancelledAt: NOW,
      cancellationReason: 'Venue flooded',
    });

    const upcoming = await Events.listEvents(db, ctxA, { group: 'upcoming' }, NOW);
    const past = await Events.listEvents(db, ctxA, { group: 'past' }, NOW);

    expect(upcoming.data).toHaveLength(0);
    expect(past.data).toHaveLength(1);
    expect(past.data[0].status).toBe('cancelled');
    expect(past.data[0].cancellationReason).toBe('Venue flooded');
  });

  it('counts registered and attended per event', async () => {
    const eventId = await makeEvent(orgA, 'Counted', new Date(NOW.getTime() - 0.5 * HOUR));
    const p1 = await makePerson(orgA, 'Ada', 'Lovelace');
    const p2 = await makePerson(orgA, 'Alan', 'Turing');

    await db.insert(attendance).values([
      { organizationId: orgA, eventId, personId: p1, state: 'attended' as const },
      { organizationId: orgA, eventId, personId: p2, state: 'registered' as const },
    ]);

    const { data } = await Events.listEvents(db, ctxA, {}, NOW);
    expect(data[0].counts).toEqual({ registered: 2, attended: 1 });
  });

  it('filters by search term', async () => {
    await makeEvent(orgA, 'Sunday Service', new Date(NOW.getTime() + HOUR));
    await makeEvent(orgA, 'Youth Night', new Date(NOW.getTime() + 2 * HOUR));

    const { data } = await Events.listEvents(db, ctxA, { q: 'sunday' }, NOW);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Sunday Service');
  });

  it('paginates by cursor without repeating or skipping', async () => {
    for (let i = 0; i < 5; i++) {
      await makeEvent(orgA, `Event ${i}`, new Date(NOW.getTime() + (i + 1) * HOUR));
    }

    const first = await Events.listEvents(db, ctxA, { limit: 2 }, NOW);
    expect(first.data).toHaveLength(2);
    expect(first.page.hasMore).toBe(true);

    const second = await Events.listEvents(db, ctxA, { limit: 2, cursor: first.page.nextCursor! }, NOW);
    const ids = new Set([...first.data, ...second.data].map((e) => e.id));
    expect(ids.size).toBe(4);
  });
});

describe('getEvent', () => {
  it("another org's event is 404, never 403 (T3)", async () => {
    const bEvent = await makeEvent(orgB, 'B only', new Date(NOW.getTime() + HOUR));
    await expect(Events.getEvent(db, ctxA, bEvent, NOW)).rejects.toMatchObject({ status: 404 });
  });
});

describe('summary — the /events hero', () => {
  it('counts and picks the spotlight', async () => {
    await makeEvent(orgA, 'Later', new Date(NOW.getTime() + 48 * HOUR));
    await makeEvent(orgA, 'Soon', new Date(NOW.getTime() + 2 * HOUR));
    await makeEvent(orgA, 'Old', new Date(NOW.getTime() - 48 * HOUR));

    const s = await Events.summary(db, ctxA, NOW);
    expect(s.total).toBe(3);
    expect(s.upcoming).toBe(2);
    expect(s.ongoing).toBe(0);
    expect(s.next?.name).toBe('Soon');
  });

  it('a live event beats an upcoming one for the spotlight', async () => {
    await makeEvent(orgA, 'Soon', new Date(NOW.getTime() + 2 * HOUR));
    await makeEvent(orgA, 'Happening now', new Date(NOW.getTime() - 0.5 * HOUR));

    const s = await Events.summary(db, ctxA, NOW);
    expect(s.ongoing).toBe(1);
    expect(s.next?.name).toBe('Happening now');
  });
});

describe('calendarMonth', () => {
  it('groups by day and excludes other months', async () => {
    await makeEvent(orgA, 'Aug 3', new Date('2026-08-03T10:00:00Z'));
    await makeEvent(orgA, 'Aug 3 later', new Date('2026-08-03T18:00:00Z'));
    await makeEvent(orgA, 'Sep 1', new Date('2026-09-01T10:00:00Z'));

    const cal = await Events.calendarMonth(db, ctxA, '2026-08', NOW);
    expect(cal.days).toHaveLength(1);
    expect(cal.days[0].date).toBe('2026-08-03');
    expect(cal.days[0].events).toHaveLength(2);
  });

  it('rejects a malformed month', async () => {
    await expect(Events.calendarMonth(db, ctxA, 'August', NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe('listPeople — replacing the 150-line useMemo', () => {
  it('scopes to the organization (T21)', async () => {
    await makePerson(orgA, 'Ada', 'Lovelace');
    await makePerson(orgB, 'Grace', 'Hopper');

    const { data } = await People.listPeople(db, ctxA, {}, NOW);
    expect(data).toHaveLength(1);
    expect(data[0].firstName).toBe('Ada');
  });

  it('computes lifetime eventsAttended', async () => {
    const personId = await makePerson(orgA, 'Ada', 'Lovelace');
    const e1 = await makeEvent(orgA, 'One', new Date(NOW.getTime() - 48 * HOUR));
    const e2 = await makeEvent(orgA, 'Two', new Date(NOW.getTime() - 24 * HOUR));

    await db.insert(attendance).values([
      { organizationId: orgA, eventId: e1, personId, state: 'attended' as const },
      { organizationId: orgA, eventId: e2, personId, state: 'attended' as const },
    ]);

    const { data } = await People.listPeople(db, ctxA, {}, NOW);
    expect(data[0].eventsAttended).toBe(2);
    expect(data[0].standing).toBe('attended');
  });

  it('someone with no attendance is `member`', async () => {
    await makePerson(orgA, 'New', 'Person');
    const { data } = await People.listPeople(db, ctxA, {}, NOW);
    expect(data[0].standing).toBe('member');
    expect(data[0].eventsAttended).toBe(0);
  });

  it('scoped to a FINISHED event, a registration that never attended is `no-show`', async () => {
    const personId = await makePerson(orgA, 'Missed', 'It');
    const eventId = await makeEvent(orgA, 'Finished', new Date(NOW.getTime() - 24 * HOUR));
    await db.insert(attendance).values({
      organizationId: orgA, eventId, personId, state: 'registered' as const,
    });

    const { data } = await People.listPeople(db, ctxA, { eventId }, NOW);
    expect(data[0].standing).toBe('no-show');
  });

  it('scoped to an UPCOMING event, the same row is `signed-up`', async () => {
    // Same data, different answer, decided by the event's timestamps — not by
    // what happened to be in a browser cache.
    const personId = await makePerson(orgA, 'Will', 'Attend');
    const eventId = await makeEvent(orgA, 'Upcoming', new Date(NOW.getTime() + 24 * HOUR));
    await db.insert(attendance).values({
      organizationId: orgA, eventId, personId, state: 'registered' as const,
    });

    const { data } = await People.listPeople(db, ctxA, { eventId }, NOW);
    expect(data[0].standing).toBe('signed-up');
  });

  it('filters by standing', async () => {
    const attendee = await makePerson(orgA, 'Was', 'There');
    await makePerson(orgA, 'Never', 'Came');
    const eventId = await makeEvent(orgA, 'Past', new Date(NOW.getTime() - 24 * HOUR));
    await db.insert(attendance).values({
      organizationId: orgA, eventId, personId: attendee, state: 'attended' as const,
    });

    const { data } = await People.listPeople(db, ctxA, { standing: 'attended' }, NOW);
    expect(data).toHaveLength(1);
    expect(data[0].firstName).toBe('Was');
  });

  it('searches name and email', async () => {
    await makePerson(orgA, 'Ada', 'Lovelace');
    await makePerson(orgA, 'Alan', 'Turing');

    const { data } = await People.listPeople(db, ctxA, { q: 'lovelace' }, NOW);
    expect(data).toHaveLength(1);
    expect(data[0].lastName).toBe('Lovelace');
  });
});

describe('getPerson', () => {
  it("another org's person is 404 (T21)", async () => {
    const bPerson = await makePerson(orgB, 'Grace', 'Hopper');
    await expect(People.getPerson(db, ctxA, bPerson)).rejects.toMatchObject({ status: 404 });
  });

  it('returns lifetime stats', async () => {
    const personId = await makePerson(orgA, 'Ada', 'Lovelace');
    const e1 = await makeEvent(orgA, 'One', new Date(NOW.getTime() - 48 * HOUR));
    const e2 = await makeEvent(orgA, 'Two', new Date(NOW.getTime() - 24 * HOUR));
    await db.insert(attendance).values([
      { organizationId: orgA, eventId: e1, personId, state: 'attended' as const },
      { organizationId: orgA, eventId: e2, personId, state: 'registered' as const },
    ]);

    const person = await People.getPerson(db, ctxA, personId);
    expect(person.stats).toEqual({ eventsAttended: 1, eventsRegistered: 2 });
  });
});

describe('people summary — the billboard tiles', () => {
  it('counts the roll and attendance', async () => {
    const p1 = await makePerson(orgA, 'A', 'One');
    const p2 = await makePerson(orgA, 'B', 'Two');
    await makePerson(orgA, 'C', 'Three');
    const eventId = await makeEvent(orgA, 'Event', new Date(NOW.getTime() - HOUR));

    await db.insert(attendance).values([
      { organizationId: orgA, eventId, personId: p1, state: 'attended' as const },
      { organizationId: orgA, eventId, personId: p2, state: 'registered' as const },
    ]);

    const s = await People.summary(db, ctxA);
    expect(s.total).toBe(3);
    expect(s.attended).toBe(1);
    expect(s.signedUp).toBe(1);
  });
});
