/**
 * Recurrence expansion, and specifically DST.
 *
 * The whole reason `recurrence.ts` is not `startAt + n * 7 * 86400000` is that
 * fixed-millisecond arithmetic moves a weekly service by an hour twice a year.
 * These tests are what make that claim checkable, so the DST cases are the
 * point of the file and the rest is scaffolding around them.
 *
 * The model is Apple Calendar's: a frequency and an end DATE, because "until
 * the end of term" is a question an organiser can answer and "how many
 * Sundays is that" is not.
 */

import { describe, expect, it } from 'bun:test';
import { MAX_OCCURRENCES, expand, toRRule, type RecurrenceFrequency } from '@credopass/lib/utils';

const HOUR = 60 * 60 * 1000;

const wallTime = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour12: false, hour: '2-digit', minute: '2-digit' }).format(d);

const wallDate = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const run = (
  frequency: RecurrenceFrequency,
  startAt: string,
  until: string,
  timezone = 'UTC',
  durationMs = HOUR
) => expand({ frequency, startAt: new Date(startAt), durationMs, timezone, until: new Date(until) });

describe('expand — DST is the whole point', () => {
  it('keeps the wall-clock time across a spring boundary', () => {
    // Europe/London goes to BST on Sunday 29 March 2026. A 10:00 service is
    // 10:00Z before and 09:00Z after. Both read as 10:00.
    const occurrences = run('weekly', '2026-03-22T10:00:00Z', '2026-04-05T00:00:00Z', 'Europe/London');

    expect(occurrences.map((o) => wallTime(o.startAt, 'Europe/London'))).toEqual(['10:00', '10:00', '10:00']);
    // The instants really do differ — not a formatting trick.
    expect(occurrences.map((o) => o.startAt.toISOString())).toEqual([
      '2026-03-22T10:00:00.000Z',
      '2026-03-29T09:00:00.000Z',
      '2026-04-05T09:00:00.000Z',
    ]);
  });

  it('keeps the wall-clock time across an autumn boundary', () => {
    // Back to GMT on Sunday 25 October 2026.
    const occurrences = run('weekly', '2026-10-18T09:00:00Z', '2026-11-01T00:00:00Z', 'Europe/London');
    expect(occurrences.map((o) => wallTime(o.startAt, 'Europe/London'))).toEqual(['10:00', '10:00', '10:00']);
    expect(occurrences[2].startAt.toISOString()).toBe('2026-11-01T10:00:00.000Z');
  });

  it('is the naive answer in a zone with no DST', () => {
    const occurrences = run('weekly', '2026-03-22T10:00:00Z', '2026-04-05T00:00:00Z', 'UTC');
    expect(occurrences[1].startAt.toISOString()).toBe('2026-03-29T10:00:00.000Z');
  });

  it('preserves the duration exactly, including over a boundary', () => {
    const occurrences = run('weekly', '2026-03-22T10:00:00Z', '2026-04-05T00:00:00Z', 'Europe/London', 90 * 60 * 1000);
    for (const o of occurrences) expect(o.endAt.getTime() - o.startAt.getTime()).toBe(90 * 60 * 1000);
  });

  it('handles daily across the boundary too', () => {
    const occurrences = run('daily', '2026-03-27T10:00:00Z', '2026-03-31T00:00:00Z', 'Europe/London');
    expect(occurrences.map((o) => wallTime(o.startAt, 'Europe/London'))).toEqual([
      '10:00', '10:00', '10:00', '10:00', '10:00',
    ]);
  });
});

describe('expand — the end date', () => {
  it('includes an occurrence falling on the end date itself', () => {
    // "Until 5 April" includes the 5th. The cutoff is the END of that day in
    // the series timezone, so a 10:00 service is not excluded by a midnight
    // interpretation of the date the organiser picked.
    const occurrences = run('weekly', '2026-04-05T10:00:00Z', '2026-04-05T00:00:00Z');
    expect(occurrences).toHaveLength(1);

    const two = run('weekly', '2026-03-29T10:00:00Z', '2026-04-05T00:00:00Z');
    expect(two).toHaveLength(2);
  });

  it('always returns the first occurrence, even if the end date precedes it', () => {
    // The organiser explicitly scheduled this event; contradictory repeat
    // settings must not delete it.
    const occurrences = run('weekly', '2026-04-05T10:00:00Z', '2020-01-01T00:00:00Z');
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].startAt.toISOString()).toBe('2026-04-05T10:00:00.000Z');
  });

  it('clamps a far-away end date to the horizon', () => {
    expect(run('daily', '2026-01-01T10:00:00Z', '2099-01-01T00:00:00Z')).toHaveLength(MAX_OCCURRENCES);
  });

  it('indexes from zero, contiguously', () => {
    const occurrences = run('weekly', '2026-01-04T10:00:00Z', '2026-02-08T00:00:00Z');
    expect(occurrences.map((o) => o.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('returns the start itself as occurrence 0, untouched', () => {
    const [first] = run('weekly', '2026-03-22T10:17:33Z', '2026-04-05T00:00:00Z', 'Europe/London');
    expect(first.index).toBe(0);
    expect(first.startAt.toISOString()).toBe('2026-03-22T10:17:33.000Z');
  });
});

describe('expand — each frequency', () => {
  it('daily steps one day', () => {
    expect(run('daily', '2026-01-04T10:00:00Z', '2026-01-07T00:00:00Z').map((o) => wallDate(o.startAt, 'UTC')))
      .toEqual(['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07']);
  });

  it('fortnightly steps 14 days', () => {
    expect(run('fortnightly', '2026-01-04T10:00:00Z', '2026-02-01T00:00:00Z').map((o) => wallDate(o.startAt, 'UTC')))
      .toEqual(['2026-01-04', '2026-01-18', '2026-02-01']);
  });

  it('monthly tracks the nth weekday, not the day of the month', () => {
    // 8 Feb 2026 is the 2nd Sunday; the 2nd Sunday after that is the 8th,
    // the 12th, the 10th. A day-of-month rule would land on a Wednesday.
    const occurrences = run('monthly', '2026-02-08T10:00:00Z', '2026-05-31T00:00:00Z');
    expect(occurrences.map((o) => wallDate(o.startAt, 'UTC'))).toEqual([
      '2026-02-08', '2026-03-08', '2026-04-12', '2026-05-10',
    ]);
    for (const o of occurrences) expect(o.startAt.getUTCDay()).toBe(0);
  });

  it('monthly skips a month with no nth weekday rather than nudging the date', () => {
    // 29 March 2026 is the 5th Sunday. Most months have no 5th Sunday: those
    // are skipped, not rolled back to the 4th, because "the 5th Sunday" means
    // the 5th Sunday and a nudge invents an event nobody asked for.
    const occurrences = run('monthly', '2026-03-29T10:00:00Z', '2026-12-31T00:00:00Z');
    for (const o of occurrences) {
      expect(o.startAt.getUTCDay()).toBe(0);
      expect(o.startAt.getUTCDate()).toBeGreaterThan(28);
    }
    // And it did not stop at the first skipped month.
    expect(occurrences.length).toBeGreaterThan(2);
  });

  it('yearly steps twelve months', () => {
    expect(run('yearly', '2026-02-08T10:00:00Z', '2029-01-01T00:00:00Z').map((o) => wallDate(o.startAt, 'UTC')))
      .toEqual(['2026-02-08', '2027-02-08', '2028-02-08']);
  });

  it('yearly clamps 29 February to the 28th in a common year', () => {
    const occurrences = run('yearly', '2028-02-29T10:00:00Z', '2030-01-01T00:00:00Z');
    expect(occurrences.map((o) => wallDate(o.startAt, 'UTC'))).toEqual(['2028-02-29', '2029-02-28']);
  });

  it('monthly crosses a year boundary', () => {
    const occurrences = run('monthly', '2026-11-08T10:00:00Z', '2027-02-01T00:00:00Z');
    expect(wallDate(occurrences[2].startAt, 'UTC').startsWith('2027-01')).toBe(true);
  });
});

describe('toRRule', () => {
  const sunday = new Date('2026-02-08T10:00:00Z'); // 2nd Sunday
  const until = new Date('2026-12-20T23:59:59Z');

  it('writes RFC 5545 for each pattern, with UNTIL rather than COUNT', () => {
    // UNTIL, because that is what the organiser chose. A count would be our
    // arithmetic rather than their intent.
    expect(toRRule('daily', sunday, 'UTC', until)).toBe('FREQ=DAILY;UNTIL=20261220T235959Z');
    expect(toRRule('weekly', sunday, 'UTC', until)).toBe('FREQ=WEEKLY;BYDAY=SU;UNTIL=20261220T235959Z');
    expect(toRRule('fortnightly', sunday, 'UTC', until)).toBe(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU;UNTIL=20261220T235959Z'
    );
    expect(toRRule('monthly', sunday, 'UTC', until)).toBe('FREQ=MONTHLY;BYDAY=2SU;UNTIL=20261220T235959Z');
    expect(toRRule('yearly', sunday, 'UTC', until)).toBe('FREQ=YEARLY;UNTIL=20261220T235959Z');
  });

  it('reckons the weekday in the series timezone, not UTC', () => {
    // 23:00 Sunday UTC is already Monday in Auckland, and the rule has to say
    // what the organiser sees.
    const lateSunday = new Date('2026-02-08T23:00:00Z');
    expect(toRRule('weekly', lateSunday, 'UTC', until)).toContain('BYDAY=SU');
    expect(toRRule('weekly', lateSunday, 'Pacific/Auckland', until)).toContain('BYDAY=MO');
  });
});

/**
 * The edge cases that would make somebody miss an event.
 *
 * Written after probing the real behaviour rather than assuming it. Each of
 * these is a case where a plausible implementation does something quietly
 * wrong, and the assertion is what stops it regressing there.
 */
describe('expand — the dangerous edges', () => {
  const wallFull = (d: Date, timeZone: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
    }).format(d);

  it('rolls a NON-EXISTENT wall time forward rather than dropping the occurrence', () => {
    // 01:30 does not exist in London on 29 March 2026 — the clocks go
    // 01:00 → 02:00. The occurrence must still happen; it lands at 02:30.
    // What matters is that it EXISTS: silently skipping a week is how a
    // congregation finds nothing in the calendar.
    const occurrences = run('weekly', '2026-03-22T01:30:00Z', '2026-04-06T00:00:00Z', 'Europe/London');
    expect(occurrences).toHaveLength(3);
    expect(wallFull(occurrences[1].startAt, 'Europe/London')).toBe('29/03/2026, 02:30');
    // And the week after is back to the asked-for time.
    expect(wallFull(occurrences[2].startAt, 'Europe/London')).toBe('05/04/2026, 01:30');
  });

  it('resolves an AMBIGUOUS wall time consistently', () => {
    // 01:30 happens twice in London on 25 October 2026. Either answer is
    // defensible; the requirement is that there is exactly one occurrence and
    // it reads as 01:30.
    const occurrences = run('weekly', '2026-10-18T00:30:00Z', '2026-11-02T00:00:00Z', 'Europe/London');
    expect(occurrences).toHaveLength(3);
    expect(wallFull(occurrences[1].startAt, 'Europe/London')).toBe('25/10/2026, 01:30');
  });

  it('keeps an event that spans a DST boundary the same length on the clock', () => {
    // 23:00 → 01:00 across the spring-forward night. The duration is
    // preserved in milliseconds, so the wall-clock end is unchanged.
    const occurrences = run('weekly', '2026-03-22T23:00:00Z', '2026-04-01T00:00:00Z', 'Europe/London', 2 * HOUR);
    for (const o of occurrences) {
      expect(wallFull(o.startAt, 'Europe/London')).toContain('23:00');
      expect(wallFull(o.endAt, 'Europe/London')).toContain('01:00');
    }
  });

  it('runs a sparse monthly series all the way to its end date', () => {
    // A "fifth Sunday" pattern occurs in roughly five months a year. The
    // step loop has to run far past the occurrence cap or the series stops
    // early — silently, which is the failure mode that loses events.
    const occurrences = run('monthly', '2026-03-29T10:00:00Z', '2036-01-01T00:00:00Z');
    expect(occurrences.length).toBeGreaterThan(40);
    // It really did reach the end of the requested span.
    expect(occurrences[occurrences.length - 1].startAt.getUTCFullYear()).toBe(2035);
  });

  it('reaches the full cap even for a sparse monthly pattern', () => {
    const occurrences = run('monthly', '2026-03-29T10:00:00Z', '2099-01-01T00:00:00Z');
    expect(occurrences).toHaveLength(MAX_OCCURRENCES);
  });
});
