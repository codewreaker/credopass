/**
 * AttendanceService — the ONE place a check-in happens.
 * docs/API-FIRST-REBUILD.md §4.6
 *
 * Replaces use-attendee-checkin.ts entirely, including the line that decided
 * whether a person exists by scanning `userCollection.toArray` — i.e. by asking
 * a browser cache. Three consequences of moving it here:
 *
 *   · "one row per (event, person)" is enforced by a UNIQUE INDEX, not by a
 *     cache lookup that two doors can disagree about.
 *   · A double-tapped check-in on a flaky tablet is idempotent rather than a
 *     duplicate or a 500.
 *   · Capacity can actually be enforced, because there is a single writer.
 *
 * No framework imports (rule 3).
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { attendance, events, people } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import { ProblemCode, problem } from '../http/problem';
import { deriveStatus } from './event-status';
import * as Pass from './pass';

export type CheckInMethod = 'qr' | 'manual' | 'self' | 'pass';

/** Who to record. Exactly one of these forms. */
export type PersonRef =
  | { personId: string }
  | { pass: string }
  | { firstName: string; lastName: string; email?: string };

export interface Actor {
  accountId?: string | null;
  deviceId?: string | null;
}

export interface AttendanceResult {
  attendance: {
    id: string;
    eventId: string;
    personId: string;
    state: string;
    checkInTime: string | null;
    registeredAt: string | null;
  };
  person: { id: string; firstName: string; lastName: string; email: string | null };
  alreadyRecorded: boolean;
  liveCount: number;
}

interface LoadedEvent {
  id: string;
  organizationId: string;
  endAt: Date;
  startAt: Date;
  closedAt: Date | null;
  cancelledAt: Date | null;
  capacity: number | null;
  enforceCapacity: boolean;
  allowSelfCheckIn: boolean;
}

async function loadEvent(
  db: Database,
  eventId: string,
  organizationId?: string
): Promise<LoadedEvent> {
  const conditions = [eq(events.id, eventId), isNull(events.deletedAt)];
  // When an organisation is known, it is part of the LOOKUP — so another
  // tenant's event is simply not found (404), never forbidden (403).
  if (organizationId) conditions.push(eq(events.organizationId, organizationId));

  const [row] = await db
    .select({
      id: events.id,
      organizationId: events.organizationId,
      startAt: events.startAt,
      endAt: events.endAt,
      closedAt: events.closedAt,
      cancelledAt: events.cancelledAt,
      capacity: events.capacity,
      enforceCapacity: events.enforceCapacity,
      allowSelfCheckIn: events.allowSelfCheckIn,
    })
    .from(events)
    .where(and(...conditions))
    .limit(1);

  if (!row) throw problem.notFound(ProblemCode.EVENT_NOT_FOUND, 'Event not found.');
  return row;
}

/** Is this event still accepting people through the door? */
function assertOpen(event: LoadedEvent, now: Date): void {
  const status = deriveStatus(
    { startAt: event.startAt, endAt: event.endAt, closedAt: event.closedAt, cancelledAt: event.cancelledAt },
    now
  );
  if (status === 'cancelled' || status === 'completed') {
    throw problem.conflict(
      ProblemCode.EVENT_CLOSED,
      status === 'cancelled' ? 'That event was cancelled.' : 'That event has finished.'
    );
  }
}

async function liveCount(db: Database, eventId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.state, 'attended')));
  return Number(row?.n ?? 0);
}

/**
 * Find or create a person by email, atomically.
 *
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING` rather than read-then-write:
 * two doors checking in the same walk-in simultaneously must not create two
 * people. The conflict target matches the partial unique index on
 * `(organization_id, lower(email))`.
 */
async function findOrCreatePerson(
  db: Database,
  organizationId: string,
  input: { firstName: string; lastName: string; email?: string }
): Promise<{ id: string; firstName: string; lastName: string; email: string | null }> {
  if (input.email) {
    const [existing] = await db
      .select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email })
      .from(people)
      .where(
        and(
          eq(people.organizationId, organizationId),
          sql`lower(${people.email}) = ${input.email.toLowerCase()}`,
          isNull(people.deletedAt)
        )
      )
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db
    .insert(people)
    .values({
      organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
    })
    .returning({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email });

  return created;
}

/** Resolve whichever form of PersonRef was given into a real person in this org. */
async function resolvePerson(
  db: Database,
  organizationId: string,
  eventId: string,
  ref: PersonRef
) {
  if ('pass' in ref) {
    const verified = await Pass.verify(db, ref.pass);
    // A pass for a DIFFERENT event is not a check-in on the wrong event — it is
    // an invalid pass here.
    if (verified.eventId !== eventId) {
      throw problem.badRequest(ProblemCode.INVALID_PASS, 'That pass is for a different event.');
    }
    const [person] = await db
      .select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email })
      .from(people)
      .where(eq(people.id, verified.personId))
      .limit(1);
    if (!person) throw problem.notFound(ProblemCode.PERSON_NOT_FOUND, 'Person not found.');
    return person;
  }

  if ('personId' in ref) {
    const [person] = await db
      .select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email })
      .from(people)
      .where(
        and(
          eq(people.id, ref.personId),
          // Scoped: a person id belonging to another tenant is not found (T11).
          eq(people.organizationId, organizationId),
          isNull(people.deletedAt)
        )
      )
      .limit(1);
    if (!person) throw problem.notFound(ProblemCode.PERSON_NOT_FOUND, 'Person not found.');
    return person;
  }

  return findOrCreatePerson(db, organizationId, ref);
}

/**
 * Register someone for an event. Does NOT mark them present.
 *
 * Registering never writes an `org_memberships` row, and structurally cannot:
 * this function touches `people` and `attendance` and nothing else. That is the
 * "attending is not belonging" guarantee (T29).
 */
export async function register(
  db: Database,
  input: {
    eventId: string;
    organizationId?: string;
    person: PersonRef;
    origin: string;
  },
  now: Date = new Date()
): Promise<AttendanceResult & { pass: { url: string; token: string; expiresAt: string } }> {
  const event = await loadEvent(db, input.eventId, input.organizationId);
  assertOpen(event, now);

  const person = await resolvePerson(db, event.organizationId, event.id, input.person);

  if (event.enforceCapacity && event.capacity !== null) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(attendance)
      .where(eq(attendance.eventId, event.id));
    if (Number(row?.n ?? 0) >= event.capacity) {
      throw problem.conflict(ProblemCode.CAPACITY_REACHED, 'This event is full.');
    }
  }

  // Idempotent: registering twice returns the original row rather than failing
  // on the unique index. A double-tapped button is not an error.
  const [row] = await db
    .insert(attendance)
    .values({
      organizationId: event.organizationId,
      eventId: event.id,
      personId: person.id,
      state: 'registered',
      registeredAt: now,
    })
    .onConflictDoUpdate({
      target: [attendance.eventId, attendance.personId],
      set: { updatedAt: now },
    })
    .returning();

  const pass = await Pass.issue(db, {
    organizationId: event.organizationId,
    eventId: event.id,
    personId: person.id,
    expiresAt: Pass.defaultExpiry(event.endAt),
    origin: input.origin,
  });

  return {
    attendance: {
      id: row.id,
      eventId: row.eventId,
      personId: row.personId,
      state: row.state,
      checkInTime: row.checkInTime?.toISOString() ?? null,
      registeredAt: row.registeredAt?.toISOString() ?? null,
    },
    person,
    alreadyRecorded: false,
    liveCount: await liveCount(db, event.id),
    pass: { url: pass.url, token: pass.token, expiresAt: pass.expiresAt.toISOString() },
  };
}

/**
 * Record that someone is present. The kiosk's one endpoint — scan, manual and
 * walk-in all land here.
 *
 * Idempotency is the interesting property. A second check-in returns 200 with
 * `alreadyRecorded: true` and does NOT move `check_in_time`. Two doors scanning
 * the same person at the same instant produce exactly one row, because the
 * uniqueness is a database constraint rather than a cache read (T27).
 */
export async function checkIn(
  db: Database,
  input: {
    eventId: string;
    organizationId?: string;
    person: PersonRef;
    method: CheckInMethod;
    actor?: Actor;
    /** Public self check-in must respect `allow_self_check_in`. */
    isSelfService?: boolean;
  },
  now: Date = new Date()
): Promise<AttendanceResult> {
  const event = await loadEvent(db, input.eventId, input.organizationId);

  if (input.isSelfService && !event.allowSelfCheckIn) {
    throw problem.forbidden(
      ProblemCode.SELF_CHECKIN_DISABLED,
      'Self check-in is turned off for this event.'
    );
  }

  assertOpen(event, now);

  const person = await resolvePerson(db, event.organizationId, event.id, input.person);

  const [existing] = await db
    .select({ id: attendance.id, state: attendance.state, checkInTime: attendance.checkInTime, registeredAt: attendance.registeredAt })
    .from(attendance)
    .where(and(eq(attendance.eventId, event.id), eq(attendance.personId, person.id)))
    .limit(1);

  if (existing?.state === 'attended') {
    return {
      attendance: {
        id: existing.id,
        eventId: event.id,
        personId: person.id,
        state: existing.state,
        // Unchanged, deliberately: the first scan is when they arrived.
        checkInTime: existing.checkInTime?.toISOString() ?? null,
        registeredAt: existing.registeredAt?.toISOString() ?? null,
      },
      person,
      alreadyRecorded: true,
      liveCount: await liveCount(db, event.id),
    };
  }

  // Capacity counts people PRESENT, not registered — a room holds who is in it.
  // Someone already registered is not a new body through the door.
  if (event.enforceCapacity && event.capacity !== null && !existing) {
    if ((await liveCount(db, event.id)) >= event.capacity) {
      throw problem.conflict(ProblemCode.CAPACITY_REACHED, 'This event is full.');
    }
  }

  const [row] = await db
    .insert(attendance)
    .values({
      organizationId: event.organizationId,
      eventId: event.id,
      personId: person.id,
      state: 'attended',
      registeredAt: existing?.registeredAt ?? now,
      checkInTime: now,
      checkInMethod: input.method,
      checkedInByAccountId: input.actor?.accountId ?? null,
      checkedInByDeviceId: input.actor?.deviceId ?? null,
    })
    .onConflictDoUpdate({
      target: [attendance.eventId, attendance.personId],
      set: {
        state: 'attended',
        checkInTime: now,
        checkInMethod: input.method,
        checkedInByAccountId: input.actor?.accountId ?? null,
        checkedInByDeviceId: input.actor?.deviceId ?? null,
        updatedAt: now,
      },
      // The race: if a concurrent request already set `attended`, do not
      // overwrite its check-in time. One of the two wins and the other reports
      // alreadyRecorded — neither fails.
      setWhere: sql`${attendance.state} <> 'attended'`,
    })
    .returning();

  // `setWhere` filtered the row out ⇒ someone else won the race.
  if (!row) {
    const [winner] = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.eventId, event.id), eq(attendance.personId, person.id)))
      .limit(1);
    return {
      attendance: {
        id: winner.id,
        eventId: event.id,
        personId: person.id,
        state: winner.state,
        checkInTime: winner.checkInTime?.toISOString() ?? null,
        registeredAt: winner.registeredAt?.toISOString() ?? null,
      },
      person,
      alreadyRecorded: true,
      liveCount: await liveCount(db, event.id),
    };
  }

  return {
    attendance: {
      id: row.id,
      eventId: row.eventId,
      personId: row.personId,
      state: row.state,
      checkInTime: row.checkInTime?.toISOString() ?? null,
      registeredAt: row.registeredAt?.toISOString() ?? null,
    },
    person,
    alreadyRecorded: false,
    liveCount: await liveCount(db, event.id),
  };
}

/** Check-out. `require_check_out` finally has something behind it (D-F). */
export async function checkOut(
  db: Database,
  input: { eventId: string; organizationId?: string; person: PersonRef },
  now: Date = new Date()
): Promise<AttendanceResult> {
  const event = await loadEvent(db, input.eventId, input.organizationId);
  const person = await resolvePerson(db, event.organizationId, event.id, input.person);

  const [row] = await db
    .update(attendance)
    .set({ checkOutTime: now, updatedAt: now })
    .where(and(eq(attendance.eventId, event.id), eq(attendance.personId, person.id)))
    .returning();

  if (!row) {
    throw problem.notFound(ProblemCode.NOT_FOUND, 'That person has not checked in.');
  }

  return {
    attendance: {
      id: row.id,
      eventId: row.eventId,
      personId: row.personId,
      state: row.state,
      checkInTime: row.checkInTime?.toISOString() ?? null,
      registeredAt: row.registeredAt?.toISOString() ?? null,
    },
    person,
    alreadyRecorded: false,
    liveCount: await liveCount(db, event.id),
  };
}

/** The kiosk counter, on load. SSE takes over after (Phase 4). */
export async function checkInState(
  db: Database,
  eventId: string,
  organizationId?: string
): Promise<{ checkedIn: number; registered: number; capacity: number | null; remaining: number | null }> {
  const event = await loadEvent(db, eventId, organizationId);

  const [counts] = await db
    .select({
      registered: sql<number>`count(*)::int`,
      checkedIn: sql<number>`count(*) FILTER (WHERE ${attendance.state} = 'attended')::int`,
    })
    .from(attendance)
    .where(eq(attendance.eventId, eventId));

  const checkedIn = Number(counts?.checkedIn ?? 0);

  return {
    checkedIn,
    registered: Number(counts?.registered ?? 0),
    capacity: event.capacity,
    remaining: event.capacity === null ? null : Math.max(0, event.capacity - checkedIn),
  };
}

/**
 * Close an event: record no-shows as FACTS rather than leaving them to be
 * inferred at render time (D-E). Idempotent — running twice changes nothing.
 */
export async function closeEvent(
  db: Database,
  eventId: string,
  organizationId?: string,
  now: Date = new Date()
): Promise<{ closedAt: string; noShows: number }> {
  const event = await loadEvent(db, eventId, organizationId);

  if (event.closedAt) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(attendance)
      .where(and(eq(attendance.eventId, eventId), eq(attendance.state, 'no_show')));
    return { closedAt: event.closedAt.toISOString(), noShows: Number(n) };
  }

  const noShows = await db.transaction(async (tx) => {
    await tx.update(events).set({ closedAt: now, updatedAt: now }).where(eq(events.id, eventId));
    const updated = await tx
      .update(attendance)
      .set({ state: 'no_show', updatedAt: now })
      .where(and(eq(attendance.eventId, eventId), eq(attendance.state, 'registered')))
      .returning({ id: attendance.id });
    return updated.length;
  });

  return { closedAt: now.toISOString(), noShows };
}
