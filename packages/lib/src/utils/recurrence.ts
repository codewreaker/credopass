/**
 * Recurrence expansion. ROADMAP stage 3, D40.
 *
 * Pure functions over dates — no database, no framework (rule 5). Everything
 * here is testable without a container, which matters because the only way to
 * be sure about DST is to assert it.
 *
 * **It lives in `packages/lib` so the composer and the API share it.**
 * It started in `services/core` and the web app re-implemented the count as
 * an average-month approximation, which was wrong by 3x for a monthly series
 * on a 5th weekday: the sheet promised ~22 events and the server wrote 8.
 * A number the UI guesses about work the server does is the same defect as
 * rendering a value you do not have. One implementation, both callers.
 *
 * **Why this is hand-written and not `rrule`.** The UI offers four patterns:
 * weekly, fortnightly, monthly-by-weekday and none. That is a small enough
 * surface that a dependency buys less than it costs — and the one thing that
 * actually has to be right here is the timezone handling, which a library
 * would not do for us anyway unless we fed it zoned input correctly. The
 * RRULE string we store is still RFC 5545, so a library can take over later
 * without a data migration.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THAT MAKES THIS NON-TRIVIAL
 * ---------------------------------------------------------------------------
 *
 * "Every Sunday at 10am" means 10am **local**, forever. Across a DST boundary
 * that is a *different UTC instant* — 10:00 Europe/London is 10:00Z in January
 * and 09:00Z in July.
 *
 * So expansion cannot be `startAt + n * 7 * 86400000`. Adding fixed
 * milliseconds moves a Sunday service by an hour twice a year, in opposite
 * directions, and nobody notices until a congregation turns up at the wrong
 * time. Instead: break the start into local wall-clock parts, advance the
 * CALENDAR, and convert each occurrence back to UTC at its own offset.
 */

/**
 * What the composer can ask for. Anything else is a one-off.
 *
 * The set is Apple Calendar's, deliberately: Never / Every Day / Every Week /
 * Every 2 Weeks / Every Month / Every Year is the vocabulary people already
 * have, and matching it means nobody has to learn ours.
 */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  /** First occurrence, as an instant. */
  startAt: Date;
  /** How long each occurrence runs. Preserved exactly across every one. */
  durationMs: number;
  /** IANA zone the pattern is reckoned in. */
  timezone: string;
  /**
   * Repeat until this instant, inclusive — "every Sunday until the end of
   * term" (F5).
   *
   * An end DATE rather than a count, because that is the question an
   * organiser can actually answer. Nobody knows how many Sundays there are
   * between now and Easter; everybody knows when Easter is. It is also what
   * Apple Calendar asks, so the mental model is already there.
   *
   * Still capped by `MAX_OCCURRENCES`: "every day until 2099" has to stop
   * somewhere, because each occurrence is a real row.
   */
  until: Date;
}

export interface Occurrence {
  index: number;
  startAt: Date;
  endAt: Date;
}

/**
 * How many occurrences a single series may materialise.
 *
 * A horizon, not infinity — see `event_series.materialised_through`. Every
 * occurrence is a real `events` row with a short code and an index entry, so
 * an end date years away would otherwise be an unbounded write from one
 * button press. 104 is two years of weekly, or three and a half months of
 * daily, and the UI says when a chosen end date has been clipped rather than
 * silently generating fewer events than asked for.
 */
export const MAX_OCCURRENCES = 104;

interface Wall {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** An instant, as wall-clock time in `timeZone`. */
function toWall(instant: Date, timeZone: string): Wall {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // `hour12: false` yields 24 for midnight in some ICU versions. Normalise.
  const hour = get('hour') % 24;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/** The zone's UTC offset, in minutes, at a given instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const w = toWall(instant, timeZone);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return (asIfUtc - instant.getTime()) / 60_000;
}

/**
 * Wall-clock time in a zone → the instant it refers to.
 *
 * Two passes, and the second is not optional. The offset we need is the one in
 * force *at the result*, but we can only look it up for an instant we already
 * have — so the first pass guesses with the offset at the naive timestamp and
 * the second corrects it when the guess landed on the other side of a DST
 * transition. Without the correction, every occurrence in the half of the year
 * opposite the series start is an hour out.
 *
 * Ambiguous and skipped wall times (the hour that repeats in autumn, the hour
 * that does not exist in spring) resolve to the offset Postgres and ICU agree
 * on for the guessed instant. An event at 01:30 on a transition night is rare
 * enough, and both answers are defensible, that this is not worth more than a
 * comment.
 */
function fromWall(w: Wall, timeZone: string): Date {
  const naive = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);
  const corrected = new Date(naive - offsetMinutes(firstGuess, timeZone) * 60_000);
  return corrected;
}

/** Day of the week of a wall-clock date, 0 = Sunday. */
const weekdayOf = (w: Wall): number =>
  new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();

/** Which occurrence of its weekday a date is within its month: 1 = first. */
const weekdayOrdinal = (w: Wall): number => Math.floor((w.day - 1) / 7) + 1;

/** Add months to a wall-clock date, clamping to the end of a short month. */
function addMonths(w: Wall, months: number): Wall {
  const month0 = w.month - 1 + months;
  const year = w.year + Math.floor(month0 / 12);
  const month = (((month0 % 12) + 12) % 12) + 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { ...w, year, month, day: Math.min(w.day, daysInMonth) };
}

/** Add days to a wall-clock date, keeping the time of day untouched. */
function addDays(w: Wall, days: number): Wall {
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day));
  d.setUTCDate(d.getUTCDate() + days);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: w.hour,
    minute: w.minute,
    second: w.second,
  };
}

/**
 * The `ordinal`-th `weekday` of a month, or null when the month has no such
 * day (a 5th Sunday does not exist most months).
 *
 * Skipping rather than clamping is deliberate: a programme set to "the 5th
 * Sunday" means the 5th Sunday. Rolling it onto the 4th would silently create
 * an event the organiser did not ask for, in a month they expected to be free.
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  ordinal: number,
  time: Pick<Wall, 'hour' | 'minute' | 'second'>
): Wall | null {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const shift = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
  const day = 1 + shift + (ordinal - 1) * 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return { year, month, day, ...time };
}

/**
 * Expand a recurrence into concrete occurrences, the first being `startAt`.
 *
 * `count` is clamped to `MAX_OCCURRENCES`. Monthly patterns can return fewer
 * than asked for, because months without an nth weekday are skipped rather
 * than nudged — see `nthWeekdayOfMonth`.
 */
export function expand(input: RecurrenceInput): Occurrence[] {
  const { frequency, startAt, durationMs, timezone, until } = input;

  const first = toWall(startAt, timezone);
  const time = { hour: first.hour, minute: first.minute, second: first.second };

  // Inclusive of the end date: "until 20 December" includes the 20th. The
  // comparison is against the END of that day in the series timezone, because
  // the organiser picked a DAY, not an instant, and a service at 10:00 on the
  // 20th must not be excluded by an end that resolved to midnight.
  const untilWall = toWall(until, timezone);
  const cutoff = fromWall({ ...untilWall, hour: 23, minute: 59, second: 59 }, timezone).getTime();

  const walls: Wall[] = [];
  const weekday = weekdayOf(first);
  const ordinal = weekdayOrdinal(first);

  /** Candidate `i`, or null when this step has no occurrence (a missing 5th Sunday). */
  const nth = (i: number): Wall | null => {
    switch (frequency) {
      case 'daily':
        return addDays(first, i);
      case 'weekly':
        return addDays(first, i * 7);
      case 'fortnightly':
        return addDays(first, i * 14);
      case 'yearly':
        return addMonths(first, i * 12);
      case 'monthly': {
        // Monthly by WEEKDAY, not day-of-month: "the second Sunday", not "the
        // 9th". A congregation meets on a weekday, and a day-of-month rule
        // would wander across the week and land on a Tuesday.
        const month0 = first.month - 1 + i;
        return nthWeekdayOfMonth(
          first.year + Math.floor(month0 / 12),
          (month0 % 12) + 1,
          weekday,
          ordinal,
          time
        );
      }
    }
  };

  // `i` runs well past the cap so a monthly pattern can skip months with no
  // nth weekday without ending the series early; `walls.length` and the end
  // date are what stop it.
  //
  // The bound is `MAX_OCCURRENCES * 12` because a 5th weekday occurs in only
  // about five months a year, so reaching 104 of them takes roughly 250
  // steps. An earlier version used `MAX_OCCURRENCES + 24`, which silently
  // truncated a long "fifth Sunday" series — the series simply stopped, with
  // nothing saying it had, which is exactly how somebody misses an event.
  const maxSteps = MAX_OCCURRENCES * 12;
  for (let i = 0; walls.length < MAX_OCCURRENCES && i < maxSteps; i += 1) {
    const candidate = nth(i);
    if (!candidate) continue;
    // The first occurrence is always included, even if the end date is the
    // same day or earlier — an event the organiser explicitly scheduled
    // should never vanish because the repeat settings disagree with it.
    if (i > 0 && fromWall(candidate, timezone).getTime() > cutoff) break;
    walls.push(candidate);
  }

  return walls.map((w, index) => {
    const start = index === 0 ? startAt : fromWall(w, timezone);
    return { index, startAt: start, endAt: new Date(start.getTime() + durationMs) };
  });
}

/** RFC 5545 UTC timestamp, e.g. `20261220T235959Z`. */
const toRRuleDate = (d: Date): string => `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

/**
 * The RFC 5545 RRULE for a pattern — stored as the record of what was asked
 * for, never read back to decide what events exist (D40).
 *
 * `UNTIL` rather than `COUNT`, matching what the organiser chose. A count
 * would be our arithmetic rather than their intent, and if the horizon ever
 * moves the stored rule should still say what they asked for.
 */
export function toRRule(
  frequency: RecurrenceFrequency,
  startAt: Date,
  timezone: string,
  until: Date
): string {
  const w = toWall(startAt, timezone);
  const day = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][weekdayOf(w)];
  const end = `UNTIL=${toRRuleDate(until)}`;

  switch (frequency) {
    case 'daily':
      return `FREQ=DAILY;${end}`;
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${day};${end}`;
    case 'fortnightly':
      return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${day};${end}`;
    case 'monthly':
      return `FREQ=MONTHLY;BYDAY=${weekdayOrdinal(w)}${day};${end}`;
    case 'yearly':
      return `FREQ=YEARLY;${end}`;
  }
}
