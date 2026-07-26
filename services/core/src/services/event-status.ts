/**
 * The ONE implementation of event status. docs/API-FIRST-REBUILD.md D2, §12.4
 *
 * Today this rule is duplicated in three places — the api-client collection,
 * the public route, and a `status` column that never ages — and they disagree.
 * A stored status is stale the moment the clock moves past `start_at`; a column
 * cannot know what time it is.
 *
 * So: no enum, no state machine, no transitions to guard. Two nullable
 * timestamps and a pure function.
 *
 * Precedence is asserted explicitly in the tests because it is the one thing a
 * reimplementation gets wrong:
 *
 *     cancelled > completed > ongoing > scheduled
 *
 * A cancelled event that is also past reads `cancelled`, not `completed`. The
 * organiser needs to know why it didn't happen.
 */

export const EVENT_STATUSES = ['scheduled', 'ongoing', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface StatusFacts {
  startAt: Date;
  endAt: Date;
  closedAt?: Date | null;
  cancelledAt?: Date | null;
}

/**
 * Reads no column that could be stale — only the recorded facts and the
 * injected clock. `now` is a parameter rather than a `new Date()` call so tests
 * can sit exactly on a boundary.
 */
export function deriveStatus(event: StatusFacts, now: Date): EventStatus {
  if (event.cancelledAt) return 'cancelled';
  if (event.closedAt) return 'completed';
  if (now.getTime() > event.endAt.getTime()) return 'completed';
  if (now.getTime() >= event.startAt.getTime()) return 'ongoing';
  return 'scheduled';
}

/** Is this event in the past, for the upcoming/past split the UI renders? */
export const isPast = (event: StatusFacts, now: Date): boolean => {
  const status = deriveStatus(event, now);
  return status === 'completed' || status === 'cancelled';
};

/**
 * SQL fragment for the same rule, so a list query can filter and sort by status
 * without loading every row into memory to ask.
 *
 * It MUST stay in step with `deriveStatus` above — a divergence between the two
 * is exactly the class of bug this file exists to remove. The test suite runs
 * the same boundary table through both.
 */
export const STATUS_SQL = `
  CASE
    WHEN cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN closed_at IS NOT NULL THEN 'completed'
    WHEN now() > "endTime" THEN 'completed'
    WHEN now() >= "startTime" THEN 'ongoing'
    ELSE 'scheduled'
  END
`;
