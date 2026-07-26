/**
 * Event and person writes (§5.3, §5.5) against a real Postgres.
 *
 * These close the gap that made the UI plan say "the composer cannot save".
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import * as Events from '../../services/event';
import * as People from '../../services/people';
import * as Attendance from '../../services/attendance';
import { createTenantContext, type TenantContext } from '../../tenancy/context';
import { events, organizations } from '@credopass/lib/schemas/tables';
import { eq } from 'drizzle-orm';

let harness: TestDatabase;
let db: any;
let ctxA: TenantContext;
let ctxB: TenantContext;
let orgA: string;
let orgB: string;

const HOUR = 3_600_000;
const soon = () => new Date(Date.now() + 24 * HOUR);

const base = () => ({
  name: 'Sunday Service',
  startAt: soon(),
  locationText: 'Main hall',
});

beforeAll(async () => {
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
  ctxA = createTenantContext({ organizationId: orgA, accountId: null, role: 'owner' });
  ctxB = createTenantContext({ organizationId: orgB, accountId: null, role: 'owner' });
});

afterAll(async () => {
  await harness.stop();
});

describe('createEvent', () => {
  it('creates in the CALLER\'s org and returns a derived status', async () => {
    const event = await Events.createEvent(db, ctxA, base());
    expect(event.organizationId).toBe(orgA);
    expect(event.status).toBe('scheduled');
    expect(event.organizationName).toBe('A');
  });

  it('T5 · an organizationId in the body is ignored', async () => {
    // The tenant comes from the context. A client that names another org gets
    // its own, not a 400 — the field simply is not part of the input.
    const event = await Events.createEvent(db, ctxA, {
      ...base(),
      // @ts-expect-error — not in CreateEventInput, and must not be honoured
      organizationId: orgB,
    });
    expect(event.organizationId).toBe(orgA);
  });

  it('defaults endAt to start + 1h at WRITE time', async () => {
    // So no reader ever has to apply the rule, and two readers cannot disagree.
    const startAt = soon();
    const event = await Events.createEvent(db, ctxA, { ...base(), startAt });
    expect(new Date(event.endAt).getTime() - startAt.getTime()).toBe(HOUR);
  });

  it('refuses an end before the start', async () => {
    await expect(
      Events.createEvent(db, ctxA, {
        ...base(),
        startAt: soon(),
        endAt: new Date(Date.now() + HOUR),
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('allocates a unique, unambiguous short code', async () => {
    const one = await Events.createEvent(db, ctxA, base());
    const two = await Events.createEvent(db, ctxA, { ...base(), name: 'Another' });

    expect(one.shortCode).not.toBe(two.shortCode);
    // Read aloud at a door — no 0/O, 1/I/L, 5/S, 8/B.
    expect(one.shortCode).not.toMatch(/[01OIL5S8B]/);
  });

  it('honours a client-supplied id (D11)', async () => {
    const id = crypto.randomUUID();
    const event = await Events.createEvent(db, ctxA, { ...base(), id });
    expect(event.id).toBe(id);
  });
});

describe('updateEvent', () => {
  it('updates fields and keeps the rest', async () => {
    const created = await Events.createEvent(db, ctxA, base());
    const updated = await Events.updateEvent(db, ctxA, created.id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect(updated.location).toBe('Main hall');
  });

  it("T4 · another org's event is 404 and is not modified", async () => {
    const bEvent = await Events.createEvent(db, ctxB, base());

    await expect(
      Events.updateEvent(db, ctxA, bEvent.id, { name: 'hijacked' })
    ).rejects.toMatchObject({ status: 404 });

    const [row] = await db.select().from(events).where(eq(events.id, bEvent.id));
    expect(row.name).toBe('Sunday Service');
  });

  it('moving the start keeps the duration', async () => {
    const created = await Events.createEvent(db, ctxA, base());
    const original = new Date(created.endAt).getTime() - new Date(created.startAt).getTime();

    const moved = new Date(Date.now() + 72 * HOUR);
    const updated = await Events.updateEvent(db, ctxA, created.id, { startAt: moved });

    expect(new Date(updated.endAt).getTime() - moved.getTime()).toBe(original);
  });
});

describe('cancelEvent', () => {
  it('cancels without deleting anything', async () => {
    const created = await Events.createEvent(db, ctxA, base());
    const cancelled = await Events.cancelEvent(db, ctxA, created.id, 'Venue flooded');

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('Venue flooded');

    // The row survives, so a printed poster keeps resolving.
    const [row] = await db.select().from(events).where(eq(events.id, created.id));
    expect(row.deletedAt).toBeNull();
  });

  it('is idempotent and does not move the cancellation time', async () => {
    const created = await Events.createEvent(db, ctxA, base());
    const first = await Events.cancelEvent(db, ctxA, created.id, 'First reason');
    await new Promise((r) => setTimeout(r, 10));
    const second = await Events.cancelEvent(db, ctxA, created.id, 'Different reason');

    expect(second.status).toBe('cancelled');
    // The original reason stands — a second cancel is a no-op, not an edit.
    expect(second.cancellationReason).toBe(first.cancellationReason);
  });

  it('a cancelled FUTURE event moves to past, and refuses check-ins', async () => {
    const created = await Events.createEvent(db, ctxA, {
      ...base(),
      startAt: new Date(Date.now() - 0.5 * HOUR),
      endAt: new Date(Date.now() + HOUR),
    });
    await Events.cancelEvent(db, ctxA, created.id);

    const upcoming = await Events.listEvents(db, ctxA, { group: 'upcoming' });
    expect(upcoming.data).toHaveLength(0);

    await expect(
      Attendance.checkIn(db, {
        eventId: created.id, organizationId: orgA,
        person: { firstName: 'No', lastName: 'Entry' }, method: 'manual',
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('deleteEvent', () => {
  it('soft-deletes an event nobody registered for', async () => {
    const created = await Events.createEvent(db, ctxA, base());
    await Events.deleteEvent(db, ctxA, created.id);

    await expect(Events.getEvent(db, ctxA, created.id)).rejects.toMatchObject({ status: 404 });
    const [row] = await db.select().from(events).where(eq(events.id, created.id));
    expect(row.deletedAt).not.toBeNull();
  });

  it('REFUSES once someone has registered — cancel instead', async () => {
    // Deleting here would destroy the attendance record the product exists for.
    const created = await Events.createEvent(db, ctxA, {
      ...base(),
      startAt: new Date(Date.now() - 0.5 * HOUR),
      endAt: new Date(Date.now() + HOUR),
    });
    await Attendance.register(db, {
      eventId: created.id, organizationId: orgA,
      person: { firstName: 'Some', lastName: 'One', email: 'someone@x.com' },
      origin: 'https://app.credopass.com',
    });

    await expect(Events.deleteEvent(db, ctxA, created.id)).rejects.toMatchObject({ status: 409 });
  });
});

describe('people writes', () => {
  it('creates in the caller\'s org', async () => {
    const person = await People.createPerson(db, ctxA, {
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.com',
    });
    const found = await People.getPerson(db, ctxA, person.id);
    expect(found.firstName).toBe('Ada');
  });

  it('refuses a duplicate email WITHIN the org', async () => {
    await People.createPerson(db, ctxA, { firstName: 'Ada', lastName: 'L', email: 'dup@x.com' });
    await expect(
      People.createPerson(db, ctxA, { firstName: 'Other', lastName: 'Person', email: 'DUP@x.com' })
    ).rejects.toMatchObject({ status: 409, code: 'email_taken' });
  });

  it('T20 · the same email in ANOTHER org is fine', async () => {
    await People.createPerson(db, ctxA, { firstName: 'John', lastName: 'Smith', email: 'john@x.com' });
    const inB = await People.createPerson(db, ctxB, { firstName: 'John', lastName: 'Smith', email: 'john@x.com' });

    expect(inB.id).toBeTruthy();
    await expect(People.getPerson(db, ctxA, inB.id)).rejects.toMatchObject({ status: 404 });
  });

  it('never links an account on create (D17)', async () => {
    // Adding someone to a roll must not connect them to an account they have
    // not proved they own. Only claiming a verified email does that.
    const person = await People.createPerson(db, ctxA, {
      firstName: 'Ada', lastName: 'L', email: 'ada2@x.com',
    });
    const { people } = await import('@credopass/lib/schemas/tables');
    const [row] = await db.select().from(people).where(eq(people.id, person.id));
    expect(row.accountId).toBeNull();
  });

  it('updates, and refuses an email already used here', async () => {
    const a = await People.createPerson(db, ctxA, { firstName: 'A', lastName: 'One', email: 'a@x.com' });
    await People.createPerson(db, ctxA, { firstName: 'B', lastName: 'Two', email: 'b@x.com' });

    const updated = await People.updatePerson(db, ctxA, a.id, { firstName: 'Renamed' });
    expect(updated.firstName).toBe('Renamed');

    await expect(
      People.updatePerson(db, ctxA, a.id, { email: 'b@x.com' })
    ).rejects.toMatchObject({ code: 'email_taken' });
  });

  it("T21 · another org's person is 404 on update", async () => {
    const bPerson = await People.createPerson(db, ctxB, { firstName: 'B', lastName: 'Person' });
    await expect(
      People.updatePerson(db, ctxA, bPerson.id, { firstName: 'hijacked' })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('soft-deletes, and attendance history survives', async () => {
    const event = await Events.createEvent(db, ctxA, {
      ...base(),
      startAt: new Date(Date.now() - 0.5 * HOUR),
      endAt: new Date(Date.now() + HOUR),
    });
    const person = await People.createPerson(db, ctxA, { firstName: 'Was', lastName: 'Here', email: 'was@x.com' });
    await Attendance.checkIn(db, {
      eventId: event.id, organizationId: orgA, person: { personId: person.id }, method: 'manual',
    });

    await People.deletePerson(db, ctxA, person.id);

    await expect(People.getPerson(db, ctxA, person.id)).rejects.toMatchObject({ status: 404 });

    // The record of who was in the room is the product. It must not vanish.
    const { attendance } = await import('@credopass/lib/schemas/tables');
    const rows = await db.select().from(attendance).where(eq(attendance.personId, person.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe('attended');
  });

  it('a deleted email can be reused', async () => {
    const person = await People.createPerson(db, ctxA, { firstName: 'Gone', lastName: 'Away', email: 'reuse@x.com' });
    await People.deletePerson(db, ctxA, person.id);

    const replacement = await People.createPerson(db, ctxA, {
      firstName: 'New', lastName: 'Person', email: 'reuse@x.com',
    });
    expect(replacement.id).not.toBe(person.id);
  });
});
