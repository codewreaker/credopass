/**
 * Whether an event happens somewhere, online, or both — derived, never stored.
 *
 * B3/F16. The roadmap's sketch for this called for a `format` COLUMN alongside
 * `location_text` and `meeting_url`, with a CHECK keeping the three coherent.
 * This does not store it, for the same reason D2 does not store event status:
 * a stored copy of something derivable has to be rewritten on every write that
 * touches its inputs, and the first write that forgets leaves a row claiming to
 * be online with no link on it. There is no state here that the two columns do
 * not already carry.
 *
 *   location_text | meeting_url | format
 *   --------------|-------------|------------
 *   set           | null        | in_person
 *   null          | set         | online
 *   set           | set         | hybrid
 *   null          | null        | unspecified
 *
 * `unspecified` is a real answer, not an error. An event may be created before
 * anyone has decided where it happens, which is the whole point of F16 — the
 * composer refused to save one at all.
 */
export const EVENT_FORMATS = ['in_person', 'online', 'hybrid', 'unspecified'] as const;

export type EventFormat = (typeof EVENT_FORMATS)[number];

export interface FormatFacts {
  locationText: string | null;
  meetingUrl: string | null;
}

export const deriveEventFormat = ({ locationText, meetingUrl }: FormatFacts): EventFormat => {
  const hasPlace = Boolean(locationText);
  const hasLink = Boolean(meetingUrl);
  if (hasPlace && hasLink) return 'hybrid';
  if (hasLink) return 'online';
  if (hasPlace) return 'in_person';
  return 'unspecified';
};

/**
 * Blank means absent.
 *
 * The column is nullable now, so `''` and `NULL` would otherwise both mean "no
 * location" and every reader would have to check for both. A form that posts an
 * untouched text input sends `''`, so this is the common case, not an edge one.
 */
export const blankToNull = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
