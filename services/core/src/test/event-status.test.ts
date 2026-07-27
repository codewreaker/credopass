/**
 * The `deriveStatus` boundary table. docs/API-FIRST-REBUILD.md §12.4
 *
 * This is the most-touched piece of logic in the product and the rule most
 * likely to be reimplemented slightly wrong somewhere else. It gets an
 * exhaustive table test, and the precedence order is asserted on its own.
 */

import { describe, expect, it } from 'bun:test';
import { deriveStatus, isPast, type StatusFacts } from '../services/event-status';

const START = new Date('2026-08-01T10:00:00Z');
const END = new Date('2026-08-01T11:00:00Z');

const base: StatusFacts = { startAt: START, endAt: END };
const at = (iso: string) => new Date(iso);

describe('deriveStatus — the boundary table (§12.4)', () => {
  const cases: Array<[string, StatusFacts, Date, string]> = [
    // cancelled_at set → cancelled, whatever else is true
    ['cancelled, before start', { ...base, cancelledAt: at('2026-07-01T00:00:00Z') }, at('2026-07-15T00:00:00Z'), 'cancelled'],
    ['cancelled, mid-window', { ...base, cancelledAt: at('2026-07-01T00:00:00Z') }, at('2026-08-01T10:30:00Z'), 'cancelled'],
    ['cancelled AND past', { ...base, cancelledAt: at('2026-07-01T00:00:00Z') }, at('2026-09-01T00:00:00Z'), 'cancelled'],
    ['cancelled AND closed', { ...base, cancelledAt: at('2026-07-01T00:00:00Z'), closedAt: at('2026-08-01T11:00:00Z') }, at('2026-09-01T00:00:00Z'), 'cancelled'],

    // closed_at set → completed regardless of the clock
    ['closed, before start', { ...base, closedAt: at('2026-07-20T00:00:00Z') }, at('2026-07-25T00:00:00Z'), 'completed'],
    ['closed, mid-window', { ...base, closedAt: at('2026-08-01T10:15:00Z') }, at('2026-08-01T10:30:00Z'), 'completed'],

    // the clock alone
    ['now < start', base, at('2026-08-01T09:59:59Z'), 'scheduled'],
    ['now == start exactly', base, START, 'ongoing'],
    ['start < now < end', base, at('2026-08-01T10:30:00Z'), 'ongoing'],
    ['now == end exactly', base, END, 'ongoing'],
    ['now > end', base, at('2026-08-01T11:00:01Z'), 'completed'],
    ['long past', base, at('2027-01-01T00:00:00Z'), 'completed'],
  ];

  for (const [label, event, now, expected] of cases) {
    it(`${label} → ${expected}`, () => {
      expect(deriveStatus(event, now)).toBe(expected as any);
    });
  }
});

describe('precedence — the thing a reimplementation gets wrong', () => {
  it('cancelled > completed', () => {
    const event = { ...base, cancelledAt: at('2026-07-01T00:00:00Z'), closedAt: at('2026-08-01T11:00:00Z') };
    expect(deriveStatus(event, at('2027-01-01T00:00:00Z'))).toBe('cancelled');
  });

  it('completed > ongoing — a closed event mid-window is completed', () => {
    const event = { ...base, closedAt: at('2026-08-01T10:10:00Z') };
    expect(deriveStatus(event, at('2026-08-01T10:30:00Z'))).toBe('completed');
  });

  it('ongoing > scheduled — the boundary is inclusive at start', () => {
    expect(deriveStatus(base, START)).toBe('ongoing');
    expect(deriveStatus(base, new Date(START.getTime() - 1))).toBe('scheduled');
  });
});

describe('the end boundary is inclusive', () => {
  // An event does not become "completed" the instant its scheduled end passes
  // a strict comparison — at exactly end_at it is still running. Off-by-one
  // here shows up as a door refusing check-ins a second early.
  it('at exactly end_at, still ongoing', () => {
    expect(deriveStatus(base, END)).toBe('ongoing');
  });

  it('one millisecond later, completed', () => {
    expect(deriveStatus(base, new Date(END.getTime() + 1))).toBe('completed');
  });
});

describe('isPast — the upcoming/past split the UI renders', () => {
  it('cancelled counts as past even when scheduled for next year', () => {
    const event = { ...base, cancelledAt: at('2026-07-01T00:00:00Z') };
    expect(isPast(event, at('2026-07-02T00:00:00Z'))).toBe(true);
  });

  it('ongoing is not past', () => {
    expect(isPast(base, at('2026-08-01T10:30:00Z'))).toBe(false);
  });

  it('scheduled is not past', () => {
    expect(isPast(base, at('2026-07-01T00:00:00Z'))).toBe(false);
  });
});

describe('a status is never stored', () => {
  it('the same row yields different statuses as the clock moves', () => {
    // The point of D2: nothing is written when an event "becomes" ongoing.
    expect(deriveStatus(base, at('2026-08-01T09:00:00Z'))).toBe('scheduled');
    expect(deriveStatus(base, at('2026-08-01T10:30:00Z'))).toBe('ongoing');
    expect(deriveStatus(base, at('2026-08-01T12:00:00Z'))).toBe('completed');
  });
});
