/**
 * Phase 3 write paths against a real Postgres. §12.3
 *
 * The check-in flow is the product's critical path, so it gets its own suite.
 * The cases that matter most are the ones a cache-based implementation gets
 * wrong: repeat scans, two doors at once, and a forged pass.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import * as Attendance from '../../services/attendance';
import * as Pass from '../../services/pass';
import { attendance, events, organizations, people } from '@credopass/lib/schemas/tables';
import { and, eq } from 'drizzle-orm';

let harness: TestDatabase;
let db: any;
let orgA: string;
let orgB: string;

const HOUR = 3_600_000;
const ORIGIN = 'https://app.credopass.com';

// A live event: started half an hour ago, runs for another 90 minutes.
const makeEvent = async (organizationId: string, extra: Record<string, unknown> = {}) => {
  const [e] = await db
    .insert(events)
    .values({
      organizationId,
      name: 'Live Event',
      startAt: new Date(Date.now() - 0.5 * HOUR),
      endAt: new Date(Date.now() + 1.5 * HOUR),
      locationText: 'Hall',
      shortCode: crypto.randomUUID().slice(0, 12),
      ...extra,
    })
    .returning({ id: events.id });
  return e.id;
};

const makePerson = async (organizationId: string, firstName = 'Ada', lastName = 'Lovelace') => {
  const [p] = await db
    .insert(people)
    .values({
      organizationId,
      firstName,
      lastName,
      email: `${firstName}.${crypto.randomUUID().slice(0, 6)}@x.com`.toLowerCase(),
    })
    .returning({ id: people.id });
  return p.id;
};

beforeAll(async () => {
  // PassService refuses to sign without a key — deliberately, since a default
  // key is the same as no signature.
  process.env.PASS_SIGNING_KEY ??= 'test-signing-key-not-for-production';
  harness = await getTestDatabase();
  db = harness.db;
});

beforeEach(async () => {
  await harness.reset();
  const [a] = await db.insert(organizations).values({ name: 'A', slug: `a-${crypto.randomUUID().slice(0, 8)}` }).returning({ id: organizations.id });
  const [b] = await db.insert(organizations).values({ name: 'B', slug: `b-${crypto.randomUUID().slice(0, 8)}` }).returning({ id: organizations.id });
  orgA = a.id;
  orgB = b.id;
});

afterAll(async () => {
  await harness.stop();
});

describe('check-in (§12.3)', () => {
  it('first check-in records state, time and method', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);

    const result = await Attendance.checkIn(db, {
      eventId, organizationId: orgA, person: { personId }, method: 'qr',
    });

    expect(result.attendance.state).toBe('attended');
    expect(result.attendance.checkInTime).not.toBeNull();
    expect(result.alreadyRecorded).toBe(false);
    expect(result.liveCount).toBe(1);
  });

  it('a repeat check-in is idempotent and does NOT move check_in_time', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);

    const first = await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'qr' });
    await new Promise((r) => setTimeout(r, 10));
    const second = await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'qr' });

    expect(second.alreadyRecorded).toBe(true);
    // The first scan is when they arrived. A second scan is not a new arrival.
    expect(second.attendance.checkInTime).toBe(first.attendance.checkInTime!);
    expect(second.liveCount).toBe(1);
  });

  it('T27 · two doors at once produce exactly ONE row', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);

    const [one, two] = await Promise.all([
      Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'qr' }),
      Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'manual' }),
    ]);

    // Neither fails. Exactly one reports it did the work.
    expect([one.alreadyRecorded, two.alreadyRecorded].filter(Boolean)).toHaveLength(1);

    const rows = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.eventId, eventId), eq(attendance.personId, personId)));
    expect(rows).toHaveLength(1);
  });

  it('a walk-in creates a person in THIS org', async () => {
    const eventId = await makeEvent(orgA);
    const result = await Attendance.checkIn(db, {
      eventId, organizationId: orgA,
      person: { firstName: 'Walk', lastName: 'In', email: 'walkin@x.com' },
      method: 'manual',
    });

    expect(result.person.firstName).toBe('Walk');
    const [row] = await db.select().from(people).where(eq(people.id, result.person.id));
    expect(row.organizationId).toBe(orgA);
  });

  it('T20 · the same email in two orgs is two different people', async () => {
    const eventA = await makeEvent(orgA);
    const eventB = await makeEvent(orgB);
    const walkIn = { firstName: 'John', lastName: 'Smith', email: 'john@x.com' };

    const inA = await Attendance.checkIn(db, { eventId: eventA, organizationId: orgA, person: walkIn, method: 'manual' });
    const inB = await Attendance.checkIn(db, { eventId: eventB, organizationId: orgB, person: walkIn, method: 'manual' });

    expect(inA.person.id).not.toBe(inB.person.id);
  });

  it('a walk-in whose email already exists here reuses that person', async () => {
    const eventId = await makeEvent(orgA);
    const existing = await makePerson(orgA, 'Known', 'Person');
    const [row] = await db.select().from(people).where(eq(people.id, existing));

    const result = await Attendance.checkIn(db, {
      eventId, organizationId: orgA,
      person: { firstName: 'Known', lastName: 'Person', email: row.email! },
      method: 'manual',
    });
    expect(result.person.id).toBe(existing);
  });

  it('T11 · a person id from another org is 404, not a cross-tenant check-in', async () => {
    const eventId = await makeEvent(orgA);
    const bPerson = await makePerson(orgB);

    await expect(
      Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId: bPerson }, method: 'manual' })
    ).rejects.toMatchObject({ status: 404, code: 'person_not_found' });
  });

  it('refuses a check-in on a finished event', async () => {
    const eventId = await makeEvent(orgA, {
      startAt: new Date(Date.now() - 48 * HOUR),
      endAt: new Date(Date.now() - 47 * HOUR),
    });
    const personId = await makePerson(orgA);

    await expect(
      Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'qr' })
    ).rejects.toMatchObject({ status: 409, code: 'event_closed' });
  });

  it('refuses a check-in on a cancelled event', async () => {
    const eventId = await makeEvent(orgA, { cancelledAt: new Date() });
    const personId = await makePerson(orgA);

    await expect(
      Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'qr' })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('capacity (D-D, T28)', () => {
  it('refuses past capacity when enforce_capacity is on', async () => {
    const eventId = await makeEvent(orgA, { capacity: 1, enforceCapacity: true });

    await Attendance.checkIn(db, {
      eventId, organizationId: orgA,
      person: { firstName: 'First', lastName: 'In', email: 'a@x.com' }, method: 'manual',
    });

    await expect(
      Attendance.checkIn(db, {
        eventId, organizationId: orgA,
        person: { firstName: 'Second', lastName: 'In', email: 'b@x.com' }, method: 'manual',
      })
    ).rejects.toMatchObject({ status: 409, code: 'capacity_reached' });
  });

  it('capacity is ADVISORY when enforce_capacity is off — preserving old behaviour', async () => {
    const eventId = await makeEvent(orgA, { capacity: 1, enforceCapacity: false });

    await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { firstName: 'A', lastName: 'One', email: 'a2@x.com' }, method: 'manual' });
    const second = await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { firstName: 'B', lastName: 'Two', email: 'b2@x.com' }, method: 'manual' });

    expect(second.attendance.state).toBe('attended');
  });

  it('someone already registered does not consume a NEW seat', async () => {
    // Capacity counts bodies in the room. A registered person walking in was
    // always going to be there.
    const eventId = await makeEvent(orgA, { capacity: 1, enforceCapacity: true });
    const personId = await makePerson(orgA);
    await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    const result = await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'qr' });
    expect(result.attendance.state).toBe('attended');
  });
});

describe('passes (D12, T12)', () => {
  it('register issues a durable, verifiable pass', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);

    const result = await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    expect(result.pass.url).toStartWith(`${ORIGIN}/p/`);
    const verified = await Pass.verify(db, result.pass.token);
    expect(verified.eventId).toBe(eventId);
    expect(verified.personId).toBe(personId);
  });

  it('the raw token is never stored — only its hash', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);
    const result = await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    const { passes } = await import('@credopass/lib/schemas/tables');
    const rows = await db.select().from(passes);
    expect(JSON.stringify(rows)).not.toContain(result.pass.token);
  });

  it('T12 · a forged signature is rejected', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);
    const { pass } = await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    const parts = pass.token.split('.');
    const forged = `${parts[0]}.${parts[1]}.${parts[2]}.deadbeefdeadbeef`;

    await expect(Pass.verify(db, forged)).rejects.toMatchObject({ code: 'invalid_pass' });
  });

  it('a hand-built token with no issued row is rejected', async () => {
    // The whole old attack: know two ids, mint a pass.
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);
    const payload = Buffer.from(
      JSON.stringify({ e: eventId, p: personId, x: Math.floor(Date.now() / 1000) + 9999 })
    ).toString('base64url');

    await expect(Pass.verify(db, `CP1.${payload}.salt.sig`)).rejects.toMatchObject({
      code: 'invalid_pass',
    });
  });

  it('a revoked pass is 410, not 400', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);
    const { pass } = await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    const verified = await Pass.verify(db, pass.token);
    await Pass.revoke(db, verified.passId);

    await expect(Pass.verify(db, pass.token)).rejects.toMatchObject({ status: 410 });
  });

  it('re-registering revokes the previous pass — never two live credentials', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);

    const first = await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });
    const second = await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    await expect(Pass.verify(db, first.pass.token)).rejects.toMatchObject({ status: 410 });
    await expect(Pass.verify(db, second.pass.token)).resolves.toBeTruthy();
  });

  it('checking in WITH a pass resolves the person', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);
    const { pass } = await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    const result = await Attendance.checkIn(db, {
      eventId, organizationId: orgA, person: { pass: pass.token }, method: 'pass',
    });
    expect(result.person.id).toBe(personId);
    expect(result.attendance.state).toBe('attended');
  });

  it("a pass for a DIFFERENT event is invalid — not a check-in on the wrong event", async () => {
    const eventOne = await makeEvent(orgA);
    const eventTwo = await makeEvent(orgA);
    const personId = await makePerson(orgA);
    const { pass } = await Attendance.register(db, { eventId: eventOne, organizationId: orgA, person: { personId }, origin: ORIGIN });

    await expect(
      Attendance.checkIn(db, { eventId: eventTwo, organizationId: orgA, person: { pass: pass.token }, method: 'pass' })
    ).rejects.toMatchObject({ code: 'invalid_pass' });
  });
});

describe('self check-in', () => {
  it('is refused when allow_self_check_in is false (T38)', async () => {
    const eventId = await makeEvent(orgA, { allowSelfCheckIn: false });
    const personId = await makePerson(orgA);

    await expect(
      Attendance.checkIn(db, {
        eventId, organizationId: orgA, person: { personId }, method: 'self', isSelfService: true,
      })
    ).rejects.toMatchObject({ status: 403, code: 'self_checkin_disabled' });
  });

  it('staff check-in is unaffected by that flag', async () => {
    const eventId = await makeEvent(orgA, { allowSelfCheckIn: false });
    const personId = await makePerson(orgA);

    const result = await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId }, method: 'manual' });
    expect(result.attendance.state).toBe('attended');
  });
});

describe('closing an event (D-E)', () => {
  it('records no-shows as FACTS rather than leaving them inferred', async () => {
    const eventId = await makeEvent(orgA);
    const attended = await makePerson(orgA, 'Came', 'Along');
    const missed = await makePerson(orgA, 'Never', 'Showed');

    await Attendance.register(db, { eventId, organizationId: orgA, person: { personId: attended }, origin: ORIGIN });
    await Attendance.register(db, { eventId, organizationId: orgA, person: { personId: missed }, origin: ORIGIN });
    await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId: attended }, method: 'qr' });

    const result = await Attendance.closeEvent(db, eventId, orgA);
    expect(result.noShows).toBe(1);

    const rows = await db.select().from(attendance).where(eq(attendance.eventId, eventId));
    expect(rows.find((r: any) => r.personId === missed).state).toBe('no_show');
    expect(rows.find((r: any) => r.personId === attended).state).toBe('attended');
  });

  it('is idempotent — closing twice does not re-count', async () => {
    const eventId = await makeEvent(orgA);
    const personId = await makePerson(orgA);
    await Attendance.register(db, { eventId, organizationId: orgA, person: { personId }, origin: ORIGIN });

    const first = await Attendance.closeEvent(db, eventId, orgA);
    const second = await Attendance.closeEvent(db, eventId, orgA);

    expect(first.noShows).toBe(1);
    expect(second.noShows).toBe(1);
    expect(second.closedAt).toBe(first.closedAt);
  });
});

describe('check-in state (the kiosk counter)', () => {
  it('reports checked-in, registered and remaining', async () => {
    const eventId = await makeEvent(orgA, { capacity: 10 });
    const a = await makePerson(orgA, 'A', 'One');
    const b = await makePerson(orgA, 'B', 'Two');

    await Attendance.register(db, { eventId, organizationId: orgA, person: { personId: a }, origin: ORIGIN });
    await Attendance.register(db, { eventId, organizationId: orgA, person: { personId: b }, origin: ORIGIN });
    await Attendance.checkIn(db, { eventId, organizationId: orgA, person: { personId: a }, method: 'qr' });

    const state = await Attendance.checkInState(db, eventId, orgA);
    expect(state).toEqual({ checkedIn: 1, registered: 2, capacity: 10, remaining: 9 });
  });
});
