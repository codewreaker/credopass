/**
 * EventService — the single authority on event status and event reads.
 * docs/API-FIRST-REBUILD.md §4.4
 *
 * Everything the `/events` and `/attendees` screens compute in the browser
 * today happens here instead: the status badge, the upcoming/past split, the
 * "2 events · 1 upcoming · 0 live now" subtitle, the hero spotlight, the
 * calendar rail. The client renders what it is given (rule 5).
 *
 * The reason that matters is not tidiness. Those screens currently derive their
 * values from a full-table cache, so page load scales with total row count and
 * two browsers can disagree about whether an event is live.
 *
 * No framework imports (rule 3).
 */

import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { attendance, events, organizations } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import type { TenantContext } from '../tenancy/context';
import { ProblemCode, problem } from '../http/problem';
import { deriveStatus, type EventStatus } from './event-status';

export interface EventSummary {
  id: string;
  name: string;
  description: string | null;
  status: EventStatus;
  startAt: string;
  endAt: string;
  location: string;
  capacity: number | null;
  organizationId: string;
  organizationName: string;
  shortCode: string;
  counts: { registered: number; attended: number };
  cancellationReason?: string | null;
}

export interface ListEventsInput {
  group?: 'upcoming' | 'past';
  status?: EventStatus[];
  from?: Date;
  to?: Date;
  q?: string;
  limit?: number;
  cursor?: string;
}

const clampLimit = (limit?: number): number => Math.min(Math.max(limit ?? 50, 1), 200);

/**
 * Cursor pagination, keyed on `(startTime, id)`.
 *
 * Offsets are wrong for this data: events are inserted and cancelled while
 * someone is paging, and an offset silently skips or repeats rows when the set
 * shifts underneath. The id tiebreak makes the order total, so two events at
 * the same instant cannot straddle a page boundary.
 */
const encodeCursor = (startAt: Date, id: string): string =>
  Buffer.from(`${startAt.toISOString()}|${id}`).toString('base64url');

const decodeCursor = (cursor: string): { startAt: Date; id: string } => {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const startAt = new Date(iso);
    if (Number.isNaN(startAt.getTime()) || !id) throw new Error('bad cursor');
    return { startAt, id };
  } catch {
    throw problem.badRequest(ProblemCode.VALIDATION_FAILED, 'Malformed cursor.');
  }
};

/** Attendance counts per event, in one query rather than N. */
async function countsFor(
  db: Database,
  eventIds: string[]
): Promise<Map<string, { registered: number; attended: number }>> {
  const result = new Map<string, { registered: number; attended: number }>();
  if (eventIds.length === 0) return result;

  const rows = await db
    .select({
      eventId: attendance.eventId,
      registered: count(),
      attended: sql<number>`count(*) FILTER (WHERE ${attendance.state} = 'attended')::int`,
    })
    .from(attendance)
    // `inArray`, not sql`= ANY(${ids})` — the template binds a JS array as a
    // single scalar parameter, which produces `ANY(($1))` and fails at runtime.
    .where(inArray(attendance.eventId, eventIds))
    .groupBy(attendance.eventId);

  for (const r of rows) {
    result.set(r.eventId, { registered: Number(r.registered), attended: Number(r.attended) });
  }
  return result;
}

const toSummary = (
  row: { events: typeof events.$inferSelect; organizations: { name: string } | null },
  counts: Map<string, { registered: number; attended: number }>,
  now: Date
): EventSummary => {
  const e = row.events;
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    status: deriveStatus(
      { startAt: e.startAt, endAt: e.endAt, closedAt: e.closedAt, cancelledAt: e.cancelledAt },
      now
    ),
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    location: e.locationText,
    capacity: e.capacity,
    organizationId: e.organizationId,
    // The client currently joins this against a full org cache (§10.1). It is
    // one row; the server has it already.
    organizationName: row.organizations?.name ?? '',
    shortCode: e.shortCode,
    counts: counts.get(e.id) ?? { registered: 0, attended: 0 },
    cancellationReason: e.cancellationReason,
  };
};

/**
 * List events for the caller's organisation.
 *
 * `group` is applied AFTER status derivation rather than as a naive
 * `startTime < now` filter, because a cancelled future event belongs in "past"
 * — it is not going to happen. That is the rule the UI already implements and
 * the one a `WHERE startTime < now()` gets wrong.
 */
export async function listEvents(
  db: Database,
  ctx: TenantContext,
  input: ListEventsInput,
  now: Date = new Date()
): Promise<{ data: EventSummary[]; page: { nextCursor: string | null; hasMore: boolean } }> {
  const limit = clampLimit(input.limit);

  const filters: SQL[] = [
    eq(events.organizationId, ctx.organizationId),
    isNull(events.deletedAt),
  ];

  if (input.from) filters.push(gte(events.startAt, input.from));
  if (input.to) filters.push(lte(events.startAt, input.to));
  if (input.q) {
    const term = `%${input.q.replace(/[%_]/g, '\\$&')}%`;
    filters.push(
      or(sql`${events.name} ILIKE ${term}`, sql`${events.locationText} ILIKE ${term}`) as SQL
    );
  }

  // Upcoming ascending (the next thing first), past descending (the most recent
  // first). This is what the screens show and it is not symmetric.
  const ascending = input.group !== 'past';

  if (input.cursor) {
    const { startAt, id } = decodeCursor(input.cursor);
    filters.push(
      ascending
        ? (sql`(${events.startAt}, ${events.id}) > (${startAt}, ${id})` as SQL)
        : (sql`(${events.startAt}, ${events.id}) < (${startAt}, ${id})` as SQL)
    );
  }

  // Over-fetch: `group` and `status` are decided from derived status, which SQL
  // cannot filter on without duplicating the rule. Fetching a window and
  // filtering in the service keeps ONE implementation of the rule (D2). At this
  // data size the cost is nothing; if it ever matters, STATUS_SQL exists.
  const rows = await db
    .select()
    .from(events)
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .where(and(...filters))
    .orderBy(
      ascending ? asc(events.startAt) : desc(events.startAt),
      ascending ? asc(events.id) : desc(events.id)
    )
    .limit(limit * 3 + 1);

  const counts = await countsFor(db, rows.map((r) => r.events.id));
  let summaries = rows.map((r) => toSummary(r, counts, now));

  if (input.group) {
    const past = input.group === 'past';
    summaries = summaries.filter((s) => {
      const isFinished = s.status === 'completed' || s.status === 'cancelled';
      return past ? isFinished : !isFinished;
    });
  }

  if (input.status?.length) {
    summaries = summaries.filter((s) => input.status!.includes(s.status));
  }

  const hasMore = summaries.length > limit;
  const data = summaries.slice(0, limit);
  const last = data.at(-1);

  return {
    data,
    page: {
      nextCursor: hasMore && last ? encodeCursor(new Date(last.startAt), last.id) : null,
      hasMore,
    },
  };
}

export async function getEvent(
  db: Database,
  ctx: TenantContext,
  eventId: string,
  now: Date = new Date()
): Promise<EventSummary> {
  const rows = await db
    .select()
    .from(events)
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .where(
      and(
        eq(events.id, eventId),
        // The tenant predicate is part of the lookup, not a check afterwards.
        // A row in another organisation is simply not found — 404, never 403,
        // so existence is never leaked (T3).
        eq(events.organizationId, ctx.organizationId),
        isNull(events.deletedAt)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    throw problem.notFound(ProblemCode.EVENT_NOT_FOUND, 'Event not found.');
  }

  const counts = await countsFor(db, [eventId]);
  return toSummary(rows[0], counts, now);
}

export interface EventsSummary {
  total: number;
  upcoming: number;
  ongoing: number;
  next: EventSummary | null;
}

/**
 * Backs the hero spotlight and the "2 events · 1 upcoming · 0 live now"
 * subtitle — currently `filter().length` over a full-table cache (§10.1).
 */
export async function summary(
  db: Database,
  ctx: TenantContext,
  now: Date = new Date()
): Promise<EventsSummary> {
  const rows = await db
    .select()
    .from(events)
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .where(and(eq(events.organizationId, ctx.organizationId), isNull(events.deletedAt)))
    .orderBy(asc(events.startAt));

  const counts = await countsFor(db, rows.map((r) => r.events.id));
  const all = rows.map((r) => toSummary(r, counts, now));

  const ongoing = all.filter((e) => e.status === 'ongoing');
  const upcoming = all.filter((e) => e.status === 'scheduled');

  return {
    total: all.length,
    upcoming: upcoming.length,
    ongoing: ongoing.length,
    // "Live now" beats "up next" in the hero: something happening right now is
    // more urgent than something later.
    next: ongoing[0] ?? upcoming[0] ?? null,
  };
}

/**
 * The calendar rail. One month, grouped by local date.
 *
 * Grouping happens here rather than in the client because the client currently
 * does it over every event it has cached, and because the day an event falls on
 * is a question about a timezone — not a substring of an ISO string.
 */
export async function calendarMonth(
  db: Database,
  ctx: TenantContext,
  month: string,
  now: Date = new Date()
): Promise<{ month: string; days: Array<{ date: string; events: EventSummary[] }> }> {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw problem.badRequest(ProblemCode.VALIDATION_FAILED, 'month must be YYYY-MM.');
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw problem.badRequest(ProblemCode.VALIDATION_FAILED, 'month must be 01-12.');
  }

  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 1));

  const rows = await db
    .select()
    .from(events)
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .where(
      and(
        eq(events.organizationId, ctx.organizationId),
        isNull(events.deletedAt),
        gte(events.startAt, from),
        sql`${events.startAt} < ${to}`
      )
    )
    .orderBy(asc(events.startAt));

  const counts = await countsFor(db, rows.map((r) => r.events.id));

  const byDay = new Map<string, EventSummary[]>();
  for (const row of rows) {
    const summary = toSummary(row, counts, now);
    const date = summary.startAt.slice(0, 10);
    const bucket = byDay.get(date);
    if (bucket) bucket.push(summary);
    else byDay.set(date, [summary]);
  }

  return {
    month,
    days: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({ date, events })),
  };
}


// ---------------------------------------------------------------------------
// Writes (§5.3)
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  /** Client-suppliable (D11). Honouring it removes the dangling-FK class of bug. */
  id?: string;
  name: string;
  description?: string | null;
  startAt: Date;
  /** Optional — defaults to start + 1h, so no READER ever has to guess (D2). */
  endAt?: Date | null;
  timezone?: string;
  locationText: string;
  capacity?: number | null;
  enforceCapacity?: boolean;
  checkInMethods?: string[];
  requireCheckOut?: boolean;
  allowSelfCheckIn?: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * A collision-checked door code.
 *
 * Read aloud at a door, so it uses the same unambiguous alphabet as a pairing
 * code. Retried on collision rather than trusted to be unique: 27^8 is a large
 * space, but "large" is not "guaranteed", and the column is UNIQUE.
 */
const CODE_ALPHABET = '234679ACDEFGHJKMNPQRTUVWXYZ';

async function allocateShortCode(db: Database): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(
      { length: 8 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join('');
    const [clash] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.shortCode, code))
      .limit(1);
    if (!clash) return code;
  }
  throw problem.internal('Could not allocate a unique short code.');
}

/**
 * `end_at` is NOT NULL in the schema, so the "no end time ⇒ assume an hour"
 * rule becomes a WRITE-time default. The old version applied it at read time,
 * in the browser, which meant every reader re-implemented it and could disagree.
 */
const resolveEndAt = (startAt: Date, endAt?: Date | null): Date => {
  const end = endAt ?? new Date(startAt.getTime() + HOUR_MS);
  if (end.getTime() <= startAt.getTime()) {
    throw problem.badRequest(
      ProblemCode.VALIDATION_FAILED,
      'The event must end after it starts.'
    );
  }
  return end;
};

export async function createEvent(
  db: Database,
  ctx: TenantContext,
  input: CreateEventInput,
  now: Date = new Date()
): Promise<EventSummary> {
  const endAt = resolveEndAt(input.startAt, input.endAt);

  const [row] = await db
    .insert(events)
    .values({
      ...(input.id ? { id: input.id } : {}),
      // From the CONTEXT, never the body. A client that sends another org's id
      // is ignored rather than obeyed (T5).
      organizationId: ctx.organizationId,
      name: input.name,
      description: input.description ?? null,
      startAt: input.startAt,
      endAt,
      timezone: input.timezone ?? 'UTC',
      locationText: input.locationText,
      capacity: input.capacity ?? null,
      enforceCapacity: input.enforceCapacity ?? false,
      shortCode: await allocateShortCode(db),
      ...(input.checkInMethods ? { checkInMethods: input.checkInMethods } : {}),
      ...(input.requireCheckOut !== undefined ? { requireCheckOut: input.requireCheckOut } : {}),
      ...(input.allowSelfCheckIn !== undefined ? { allowSelfCheckIn: input.allowSelfCheckIn } : {}),
    })
    .returning({ id: events.id });

  return getEvent(db, ctx, row.id, now);
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'id'>>;

export async function updateEvent(
  db: Database,
  ctx: TenantContext,
  eventId: string,
  patch: UpdateEventInput,
  now: Date = new Date()
): Promise<EventSummary> {
  // Reuses the scoped lookup, so another tenant's event is a 404 before
  // anything is written.
  const existing = await getEvent(db, ctx, eventId, now);

  const startAt = patch.startAt ?? new Date(existing.startAt);
  const endAt =
    patch.endAt !== undefined || patch.startAt !== undefined
      ? resolveEndAt(startAt, patch.endAt ?? (patch.startAt ? null : new Date(existing.endAt)))
      : undefined;

  await db
    .update(events)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.startAt !== undefined ? { startAt } : {}),
      ...(endAt ? { endAt } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      ...(patch.locationText !== undefined ? { locationText: patch.locationText } : {}),
      ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
      ...(patch.enforceCapacity !== undefined ? { enforceCapacity: patch.enforceCapacity } : {}),
      ...(patch.checkInMethods !== undefined ? { checkInMethods: patch.checkInMethods } : {}),
      ...(patch.requireCheckOut !== undefined ? { requireCheckOut: patch.requireCheckOut } : {}),
      ...(patch.allowSelfCheckIn !== undefined ? { allowSelfCheckIn: patch.allowSelfCheckIn } : {}),
      updatedAt: now,
    })
    .where(and(eq(events.id, eventId), eq(events.organizationId, ctx.organizationId)));

  return getEvent(db, ctx, eventId, now);
}

/**
 * Cancel. Idempotent, and NEVER deletes.
 *
 * A cancelled event keeps its attendance rows (you have to tell those people),
 * keeps its URL resolving so a printed poster reads "cancelled" rather than
 * 404ing, refuses new check-ins, and stays in the organiser's history (D2).
 */
export async function cancelEvent(
  db: Database,
  ctx: TenantContext,
  eventId: string,
  reason?: string,
  now: Date = new Date()
): Promise<EventSummary> {
  const existing = await getEvent(db, ctx, eventId, now);

  if (existing.status !== 'cancelled') {
    await db
      .update(events)
      .set({ cancelledAt: now, cancellationReason: reason ?? null, updatedAt: now })
      .where(and(eq(events.id, eventId), eq(events.organizationId, ctx.organizationId)));
  }

  return getEvent(db, ctx, eventId, now);
}

/**
 * Soft delete. Refuses once anyone has registered — deleting then would destroy
 * the attendance record the product exists to keep. Cancel instead.
 */
export async function deleteEvent(
  db: Database,
  ctx: TenantContext,
  eventId: string,
  now: Date = new Date()
): Promise<void> {
  await getEvent(db, ctx, eventId, now);

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attendance)
    .where(eq(attendance.eventId, eventId));

  if (Number(n) > 0) {
    throw problem.conflict(
      ProblemCode.CONFLICT,
      `${n} person(s) have registered. Cancel the event instead of deleting it.`
    );
  }

  await db
    .update(events)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(events.id, eventId), eq(events.organizationId, ctx.organizationId)));
}
