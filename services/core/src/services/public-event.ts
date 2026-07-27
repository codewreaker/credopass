/**
 * The public projection of an event, and of a pass.
 * docs/API-FIRST-REBUILD.md §5.10
 *
 * Lives in a service rather than the route file because deciding what an
 * anonymous visitor may see is a domain question, not a transport one — and
 * because the lint rule that flagged it was right: routes reach tables through
 * services, never directly (§7.1).
 *
 * No framework imports (rule 3).
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { attendance, events, organizations, people } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import { ProblemCode, problem } from '../http/problem';
import { deriveStatus, type EventStatus } from './event-status';

export interface PublicEvent {
  id: string;
  name: string;
  description: string | null;
  status: EventStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  location: string;
  organizationName: string;
  allowSelfCheckIn: boolean;
  capacityRemaining: number | null;
  cancellationReason: string | null;
}

/**
 * The public projection of an event.
 *
 * Note what is NOT here: no attendee list, no counts of who registered, no
 * organiser details. A public page shows what a poster would show.
 */
export async function loadPublicEvent(
  db: Database,
  eventId: string,
  now = new Date()
): Promise<PublicEvent> {
  const [row] = await db
    .select({
      id: events.id,
      name: events.name,
      description: events.description,
      startAt: events.startAt,
      endAt: events.endAt,
      timezone: events.timezone,
      location: events.locationText,
      capacity: events.capacity,
      enforceCapacity: events.enforceCapacity,
      allowSelfCheckIn: events.allowSelfCheckIn,
      closedAt: events.closedAt,
      cancelledAt: events.cancelledAt,
      cancellationReason: events.cancellationReason,
      organizationName: organizations.name,
    })
    .from(events)
    .innerJoin(organizations, eq(organizations.id, events.organizationId))
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!row) throw problem.notFound(ProblemCode.EVENT_NOT_FOUND, 'Event not found.');

  let capacityRemaining: number | null = null;
  if (row.capacity !== null) {
    const [counts] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(attendance)
      .where(eq(attendance.eventId, eventId));
    capacityRemaining = Math.max(0, row.capacity - Number(counts?.n ?? 0));
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: deriveStatus(
      { startAt: row.startAt, endAt: row.endAt, closedAt: row.closedAt, cancelledAt: row.cancelledAt },
      now
    ),
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    location: row.location,
    organizationName: row.organizationName,
    allowSelfCheckIn: row.allowSelfCheckIn,
    capacityRemaining,
    // Shown on the public page: a printed poster keeps resolving, and now says
    // WHY it isn't happening rather than 404ing.
    cancellationReason: row.cancellationReason,
  };
}


/** What the holder of a pass may see. First name and last INITIAL only (T35). */
export async function passView(
  db: Database,
  input: { eventId: string; personId: string }
): Promise<{
  person: { firstName: string; lastInitial: string };
  attendance: { state: string; checkInTime: string | null };
}> {
  const [person] = await db
    .select({ firstName: people.firstName, lastName: people.lastName })
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1);

  const [row] = await db
    .select({ state: attendance.state, checkInTime: attendance.checkInTime })
    .from(attendance)
    .where(and(eq(attendance.eventId, input.eventId), eq(attendance.personId, input.personId)))
    .limit(1);

  return {
    person: {
      firstName: person?.firstName ?? '',
      // Never the surname, never the email. A pass gets forwarded.
      lastInitial: (person?.lastName ?? '').slice(0, 1),
    },
    attendance: {
      state: row?.state ?? 'registered',
      checkInTime: row?.checkInTime?.toISOString() ?? null,
    },
  };
}

/**
 * Is this address registered for this event?
 *
 * Returns a value the caller must NOT branch a response on — see the resend-pass
 * route. It exists so NotificationService has something to enqueue against, not
 * so the API can tell a stranger who is attending.
 */
export async function findRegistration(
  db: Database,
  eventId: string,
  email: string
): Promise<{ personId: string } | null> {
  const [row] = await db
    .select({ personId: people.id })
    .from(people)
    .innerJoin(attendance, eq(attendance.personId, people.id))
    .where(and(eq(attendance.eventId, eventId), sql`lower(${people.email}) = ${email.toLowerCase()}`))
    .limit(1);
  return row ?? null;
}
