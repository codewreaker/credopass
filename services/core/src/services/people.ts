/**
 * PeopleService — the tenant's roll of attendees.
 * docs/API-FIRST-REBUILD.md §4.3
 *
 * This replaces the ~150-line `useMemo` at Attendees/index.tsx:342-435 and the
 * full-table attendance scan at :295. Two reasons that matters beyond tidiness:
 *
 *   · `eventsAttended` is currently computed by scanning EVERY attendance row
 *     in the browser, so the page gets slower as the product succeeds.
 *   · "standing" is computed from whatever happens to be cached, so two tabs
 *     can disagree about whether someone is a no-show.
 *
 * No framework imports (rule 3).
 */

import { and, asc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { attendance, events, people } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import type { TenantContext } from '../tenancy/context';
import { ProblemCode, problem } from '../http/problem';

/**
 * What the badge on each row says.
 *
 * `member` means "on this org's roll but has not attended anything yet" — which
 * is what the label always implied. It used to mean "a `users` row with no
 * attendance and no sign-up", which in practice meant the seeded fixtures.
 * Expect the count to drop; that is a correction, not a regression (§10.2).
 */
export const STANDINGS = ['attended', 'no-show', 'signed-up', 'member'] as const;
export type Standing = (typeof STANDINGS)[number];

export interface PersonRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  standing: Standing;
  eventsAttended: number;
  checkInTime: string | null;
}

export interface ListPeopleInput {
  q?: string;
  eventId?: string;
  standing?: Standing;
  limit?: number;
  cursor?: string;
}

const clampLimit = (limit?: number): number => Math.min(Math.max(limit ?? 50, 1), 200);

const encodeCursor = (lastName: string, id: string): string =>
  Buffer.from(`${lastName}|${id}`).toString('base64url');

const decodeCursor = (cursor: string): { lastName: string; id: string } => {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const idx = raw.lastIndexOf('|');
    if (idx < 0) throw new Error('bad cursor');
    return { lastName: raw.slice(0, idx), id: raw.slice(idx + 1) };
  } catch {
    throw problem.badRequest(ProblemCode.VALIDATION_FAILED, 'Malformed cursor.');
  }
};

/**
 * Standing in the context of ONE event, decided server-side.
 *
 * The no-show case is the interesting one. Today it is inferred at render time
 * — "registered, and the event looks finished" — so it is not a recorded fact
 * and cannot be corrected or audited. Here it is still derived, but from the
 * event's own timestamps rather than from whatever the browser cached.
 * Phase 3 records it properly at close (D-E).
 */
function standingFor(
  row: { attended: boolean | null; hasAttendanceRow: boolean; eventFinished: boolean }
): Standing {
  if (!row.hasAttendanceRow) return 'member';
  if (row.attended) return 'attended';
  return row.eventFinished ? 'no-show' : 'signed-up';
}

/**
 * List the roll, with standing and lifetime counts already decided.
 *
 * `eventId` switches the meaning of `standing` from lifetime to that event —
 * which is what the scope dropdown on /attendees does.
 */
export async function listPeople(
  db: Database,
  ctx: TenantContext,
  input: ListPeopleInput,
  now: Date = new Date()
): Promise<{ data: PersonRow[]; page: { nextCursor: string | null; hasMore: boolean } }> {
  const limit = clampLimit(input.limit);

  const filters: SQL[] = [
    eq(people.organizationId, ctx.organizationId),
    isNull(people.deletedAt),
  ];

  if (input.q) {
    const term = `%${input.q.replace(/[%_]/g, '\\$&')}%`;
    filters.push(
      or(
        sql`${people.firstName} ILIKE ${term}`,
        sql`${people.lastName} ILIKE ${term}`,
        sql`${people.email} ILIKE ${term}`
      ) as SQL
    );
  }

  if (input.cursor) {
    const { lastName, id } = decodeCursor(input.cursor);
    filters.push(sql`(${people.lastName}, ${people.id}) > (${lastName}, ${id})` as SQL);
  }

  // Correlated subqueries, with the OUTER column written out in full.
  //
  // `${people.id}` cannot be used here: drizzle renders a column reference as a
  // bare `"id"`, and inside `FROM attendance a` that resolves to
  // `attendance.id` — a valid column, so Postgres accepts it silently and the
  // count comes back 0. Qualifying it as `"people"."id"` is the fix, and the
  // reason this is spelled out rather than interpolated.
  const OUTER_PERSON_ID = sql.raw('"people"."id"');

  const attendedCount = sql<number>`(
    SELECT count(*)::int FROM ${attendance} a
     WHERE a.person_id = ${OUTER_PERSON_ID} AND a.state = 'attended'
  )`;

  // Per-event facts, only when scoped to an event.
  const eventScoped = input.eventId
    ? {
        attended: sql<boolean | null>`(
          SELECT (a.state = 'attended') FROM ${attendance} a
           WHERE a.person_id = ${OUTER_PERSON_ID} AND a.event_id = ${input.eventId} LIMIT 1
        )`,
        hasRow: sql<boolean>`EXISTS (
          SELECT 1 FROM ${attendance} a
           WHERE a.person_id = ${OUTER_PERSON_ID} AND a.event_id = ${input.eventId}
        )`,
        checkInTime: sql<Date | null>`(
          SELECT a.check_in_time FROM ${attendance} a
           WHERE a.person_id = ${OUTER_PERSON_ID} AND a.event_id = ${input.eventId} LIMIT 1
        )`,
      }
    : null;

  const rows = await db
    .select({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      email: people.email,
      phone: people.phone,
      eventsAttended: attendedCount,
      ...(eventScoped
        ? { attended: eventScoped.attended, hasRow: eventScoped.hasRow, checkInTime: eventScoped.checkInTime }
        : {}),
    })
    .from(people)
    .where(and(...filters))
    .orderBy(asc(people.lastName), asc(people.id))
    .limit(limit + 1);

  // Is the scoped event finished? One lookup, not one per row.
  let eventFinished = false;
  if (input.eventId) {
    const [ev] = await db
      .select({ endAt: events.endAt, closedAt: events.closedAt, cancelledAt: events.cancelledAt })
      .from(events)
      .where(and(eq(events.id, input.eventId), eq(events.organizationId, ctx.organizationId)))
      .limit(1);
    if (!ev) throw problem.notFound(ProblemCode.EVENT_NOT_FOUND, 'Event not found.');
    eventFinished = Boolean(ev.closedAt || ev.cancelledAt || now > ev.endAt);
  }

  let data: PersonRow[] = rows.map((r: any) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    eventsAttended: Number(r.eventsAttended ?? 0),
    checkInTime: r.checkInTime ? new Date(r.checkInTime).toISOString() : null,
    standing: input.eventId
      ? standingFor({ attended: r.attended, hasAttendanceRow: Boolean(r.hasRow), eventFinished })
      : Number(r.eventsAttended ?? 0) > 0
        ? 'attended'
        : 'member',
  }));

  if (input.standing) data = data.filter((p) => p.standing === input.standing);

  const hasMore = data.length > limit;
  const page = data.slice(0, limit);
  const last = page.at(-1);

  return {
    data: page,
    page: {
      nextCursor: hasMore && last ? encodeCursor(last.lastName, last.id) : null,
      hasMore,
    },
  };
}

/** The lime billboard tiles on /attendees. */
export async function summary(
  db: Database,
  ctx: TenantContext,
  eventId?: string
): Promise<{ total: number; attended: number; signedUp: number; noShows: number }> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(people)
    .where(and(eq(people.organizationId, ctx.organizationId), isNull(people.deletedAt)));

  const scope = eventId
    ? and(eq(attendance.organizationId, ctx.organizationId), eq(attendance.eventId, eventId))
    : eq(attendance.organizationId, ctx.organizationId);

  const [counts] = await db
    .select({
      attended: sql<number>`count(*) FILTER (WHERE ${attendance.state} = 'attended')::int`,
      registered: sql<number>`count(*)::int`,
    })
    .from(attendance)
    .where(scope);

  const attended = Number(counts?.attended ?? 0);
  const registered = Number(counts?.registered ?? 0);

  return {
    total: Number(total),
    attended,
    signedUp: registered - attended,
    // Only meaningful once an event has finished; Phase 3 records it as a fact
    // at close (D-E) rather than inferring it here.
    noShows: eventId ? registered - attended : 0,
  };
}

export async function getPerson(db: Database, ctx: TenantContext, personId: string) {
  const [person] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.id, personId),
        // Tenant predicate is part of the lookup: another org's person is
        // simply not found (T21).
        eq(people.organizationId, ctx.organizationId),
        isNull(people.deletedAt)
      )
    )
    .limit(1);

  if (!person) throw problem.notFound(ProblemCode.PERSON_NOT_FOUND, 'Person not found.');

  const [stats] = await db
    .select({
      eventsAttended: sql<number>`count(*) FILTER (WHERE ${attendance.state} = 'attended')::int`,
      eventsRegistered: sql<number>`count(*)::int`,
    })
    .from(attendance)
    .where(eq(attendance.personId, personId));

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone,
    notes: person.notes,
    createdAt: person.createdAt.toISOString(),
    stats: {
      eventsAttended: Number(stats?.eventsAttended ?? 0),
      eventsRegistered: Number(stats?.eventsRegistered ?? 0),
    },
  };
}


// ---------------------------------------------------------------------------
// Writes (§5.5)
// ---------------------------------------------------------------------------

export interface CreatePersonInput {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

/**
 * Add someone to the roll.
 *
 * Email uniqueness is PER ORGANISATION, case-insensitive, ignoring soft-deleted
 * rows — the constraint the database enforces. Two organisations may both have
 * john@gmail.com, and neither can see the other's row (T20).
 */
export async function createPerson(
  db: Database,
  ctx: TenantContext,
  input: CreatePersonInput
): Promise<{ id: string; firstName: string; lastName: string; email: string | null; phone: string | null }> {
  if (input.email) {
    const [clash] = await db
      .select({ id: people.id })
      .from(people)
      .where(
        and(
          eq(people.organizationId, ctx.organizationId),
          sql`lower(${people.email}) = ${input.email.toLowerCase()}`,
          isNull(people.deletedAt)
        )
      )
      .limit(1);
    if (clash) {
      throw problem.conflict(ProblemCode.EMAIL_TAKEN, 'Someone with that email is already on this roll.');
    }
  }

  const [row] = await db
    .insert(people)
    .values({
      ...(input.id ? { id: input.id } : {}),
      organizationId: ctx.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      // NEVER set account_id here. That is set only by claiming a verified
      // email (D17) — adding someone to a roll must not link them to an
      // account they have not proved they own.
    })
    .returning({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      email: people.email,
      phone: people.phone,
    });

  return row;
}

export type UpdatePersonInput = Partial<Omit<CreatePersonInput, 'id'>>;

export async function updatePerson(
  db: Database,
  ctx: TenantContext,
  personId: string,
  patch: UpdatePersonInput,
  now: Date = new Date()
) {
  await getPerson(db, ctx, personId);

  if (patch.email) {
    const [clash] = await db
      .select({ id: people.id })
      .from(people)
      .where(
        and(
          eq(people.organizationId, ctx.organizationId),
          sql`lower(${people.email}) = ${patch.email.toLowerCase()}`,
          sql`${people.id} <> ${personId}`,
          isNull(people.deletedAt)
        )
      )
      .limit(1);
    if (clash) {
      throw problem.conflict(ProblemCode.EMAIL_TAKEN, 'Someone with that email is already on this roll.');
    }
  }

  await db
    .update(people)
    .set({
      ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      updatedAt: now,
    })
    .where(and(eq(people.id, personId), eq(people.organizationId, ctx.organizationId)));

  return getPerson(db, ctx, personId);
}

/**
 * SOFT delete, always.
 *
 * Attendance history must survive removing someone from a roll — the record of
 * who was in the room on a given night is the product. A hard delete would
 * cascade it away.
 */
export async function deletePerson(
  db: Database,
  ctx: TenantContext,
  personId: string,
  now: Date = new Date()
): Promise<void> {
  await getPerson(db, ctx, personId);
  await db
    .update(people)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(people.id, personId), eq(people.organizationId, ctx.organizationId)));
}
