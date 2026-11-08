/**
 * TicketsService — the personal scope. docs/API-FIRST-REBUILD.md §3.2, D17, D26
 *
 * Everything else in `src/services/` answers "what may this ORGANISATION see?".
 * This file answers the only other question the data model supports: "what may
 * this PERSON see about themselves, across every organisation they have ever
 * attended anything in?"
 *
 * The hinge is `people.account_id`, and the two paths never touch:
 *
 *   · Org-scoped reads filter on `organization_id` and never look at
 *     `account_id`.
 *   · This file filters on `account_id` and never takes an organisation.
 *
 * So a host reading their attendee list cannot reach someone's other tickets,
 * and someone reading their own tickets cannot reach an attendee list. Neither
 * query can be made to produce the other's rows by changing a parameter,
 * because neither accepts the other's parameter.
 *
 * **Attending is not belonging** (T29). Nothing here reads, writes or implies
 * `org_memberships`. Appearing in this list means an organisation holds a
 * `people` row that was claimed by this account — not that the account is a
 * member of that organisation, and not that it may see anything else of theirs.
 *
 * No framework imports (rule 3).
 */

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  attendance,
  attendanceState,
  events,
  organizations,
  people,
} from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import { deriveEventFormat, type EventFormat } from './event-format';
import { deriveStatus, type EventStatus } from './event-status';
import { ProblemCode, problem } from '../http/problem';
import * as Pass from './pass';

/** Which half of the list: what is still to come, or what already happened. */
export const TICKET_GROUPS = ['upcoming', 'past'] as const;
export type TicketGroup = (typeof TICKET_GROUPS)[number];

/**
 * The attendance vocabulary, re-exported for the route's response schema.
 *
 * Routes may not import table objects (§7.1), and this is the only place the
 * enum is otherwise reachable from — so the service hands it over rather than
 * the route restating the four strings and letting them drift from the column.
 */
export const ATTENDANCE_STATES = attendanceState.enumValues;
export type AttendanceState = (typeof ATTENDANCE_STATES)[number];

export interface Ticket {
  eventId: string;
  name: string;
  status: EventStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  format: EventFormat;
  coverImageUrl: string | null;
  /** Who is running it. The only thing this list says about the organisation. */
  organizationName: string;
  /** `registered` · `attended` · `no_show` … — the recorded fact, not a guess. */
  attendanceState: AttendanceState;
  registeredAt: string | null;
  checkInTime: string | null;
}

/**
 * Every event this account is on the attendee list for.
 *
 * `upcoming` and `past` use the SAME rule the host-facing list uses —
 * `deriveStatus`, in SQL — so an event cannot appear under Upcoming on one
 * screen and Past on another. A cancelled future event sorts into `past`, for
 * the reason §2.3 gives: it is not going to happen, so it belongs with what
 * didn't.
 *
 * Soft-deleted people and events are excluded. An organisation that removed
 * someone from its roll has removed the link; it has not rewritten the
 * attendee's memory of going, but it has withdrawn the row this reads.
 */
export async function listTickets(
  db: Database,
  accountId: string,
  group: TicketGroup,
  now: Date = new Date()
): Promise<Ticket[]> {
  const past = sql`(${events.cancelledAt} IS NOT NULL OR ${events.closedAt} IS NOT NULL OR ${events.endAt} < ${now})`;

  const rows = await db
    .select({
      eventId: events.id,
      name: events.name,
      startAt: events.startAt,
      endAt: events.endAt,
      timezone: events.timezone,
      location: events.locationText,
      meetingUrl: events.meetingUrl,
      coverImageUrl: events.coverImageUrl,
      closedAt: events.closedAt,
      cancelledAt: events.cancelledAt,
      organizationName: organizations.name,
      attendanceState: attendance.state,
      registeredAt: attendance.registeredAt,
      checkInTime: attendance.checkInTime,
    })
    .from(attendance)
    .innerJoin(people, eq(people.id, attendance.personId))
    .innerJoin(events, eq(events.id, attendance.eventId))
    .innerJoin(organizations, eq(organizations.id, events.organizationId))
    .where(
      and(
        // The whole of the authorization check. No organisation is named, and
        // none can be passed in.
        eq(people.accountId, accountId),
        isNull(people.deletedAt),
        isNull(events.deletedAt),
        group === 'past' ? past : sql`NOT ${past}`
      )
    )
    // Upcoming reads forwards from now; past reads backwards from now. Both
    // put the event you care about first.
    .orderBy(group === 'past' ? desc(events.startAt) : asc(events.startAt))
    .limit(200);

  return rows.map((row) => ({
    eventId: row.eventId,
    name: row.name,
    status: deriveStatus(
      {
        startAt: row.startAt,
        endAt: row.endAt,
        closedAt: row.closedAt,
        cancelledAt: row.cancelledAt,
      },
      now
    ),
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    location: row.location,
    meetingUrl: row.meetingUrl,
    format: deriveEventFormat({ locationText: row.location, meetingUrl: row.meetingUrl }),
    coverImageUrl: row.coverImageUrl,
    organizationName: row.organizationName,
    attendanceState: row.attendanceState,
    registeredAt: row.registeredAt?.toISOString() ?? null,
    checkInTime: row.checkInTime?.toISOString() ?? null,
  }));
}

/** How many tickets sit on each side of the switch. One query, two counts. */
export async function ticketCounts(
  db: Database,
  accountId: string,
  now: Date = new Date()
): Promise<{ upcoming: number; past: number }> {
  const past = sql`(${events.cancelledAt} IS NOT NULL OR ${events.closedAt} IS NOT NULL OR ${events.endAt} < ${now})`;

  const [row] = await db
    .select({
      upcoming: sql<number>`count(*) FILTER (WHERE NOT ${past})::int`,
      past: sql<number>`count(*) FILTER (WHERE ${past})::int`,
    })
    .from(attendance)
    .innerJoin(people, eq(people.id, attendance.personId))
    .innerJoin(events, eq(events.id, attendance.eventId))
    .where(
      and(eq(people.accountId, accountId), isNull(people.deletedAt), isNull(events.deletedAt))
    );

  return { upcoming: Number(row?.upcoming ?? 0), past: Number(row?.past ?? 0) };
}

/**
 * Reissue the caller's own pass for one event.
 *
 * The raw token is never stored — only its SHA-256 — so there is no "fetch my
 * pass": the link that was handed over at registration genuinely is the only
 * copy. The honest way to put a pass back in someone's hands is therefore to
 * mint a new one, which is what this does.
 *
 * It **revokes the previous pass**, because `uq_passes_event_person_live`
 * allows exactly one live pass per person per event. The pass screen has always
 * said so in as many words ("it replaces any earlier one you were sent"), and
 * the register flow already behaved this way. Nothing new is being traded away
 * here; it is simply the first place a person can trigger it deliberately.
 *
 * Authorization is `people.account_id`, exactly as in `listTickets` — the
 * caller gets a pass for a person row that is theirs, in whichever organisation
 * holds it, and 404s on anything else. 404 and not 403: whether an event exists
 * is not this endpoint's to disclose (rule 6).
 */
export async function reissuePass(
  db: Database,
  accountId: string,
  eventId: string,
  origin: string
): Promise<{ url: string; token: string; expiresAt: string }> {
  const [row] = await db
    .select({
      personId: people.id,
      organizationId: events.organizationId,
      endAt: events.endAt,
    })
    .from(attendance)
    .innerJoin(people, eq(people.id, attendance.personId))
    .innerJoin(events, eq(events.id, attendance.eventId))
    .where(
      and(
        eq(attendance.eventId, eventId),
        eq(people.accountId, accountId),
        isNull(people.deletedAt),
        isNull(events.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    throw problem.notFound(ProblemCode.EVENT_NOT_FOUND, 'You have no ticket for that event.');
  }

  const pass = await Pass.issue(db, {
    organizationId: row.organizationId,
    eventId,
    personId: row.personId,
    expiresAt: Pass.defaultExpiry(row.endAt),
    origin,
  });

  return { url: pass.url, token: pass.token, expiresAt: pass.expiresAt.toISOString() };
}
