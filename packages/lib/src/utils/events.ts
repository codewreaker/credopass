/**
 * Event Utilities
 *
 * Almost nothing lives here any more, and that is the point. Status derivation,
 * grouping, sorting and month-filtering all moved server-side — `deriveStatus`
 * runs from the timestamps in `services/core`, and `GET /events` answers
 * `?group=upcoming|past`. A browser-side copy would be a second implementation
 * of the same rule, and the two would disagree the first time an event was
 * cancelled (API-SECOND-REBUILD §2.3).
 */

import { tzList } from '../constants';

/** Calendar day cells key off this: a date → `2026-09-08` for map lookups. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Derive a union type from your tzList constant
type TimeZone = typeof tzList[number];

export const getTimeZone = (userTimeZone: TimeZone, startDate?: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: userTimeZone,
    timeZoneName: 'shortOffset'
  })
    .formatToParts(startDate ?? new Date())
    .find(part => part.type === 'timeZoneName')?.value ?? '';
};
