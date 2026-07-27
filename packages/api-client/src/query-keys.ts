/**
 * Query keys.
 *
 * Every organization-scoped key begins `['org', organizationId, …]`. That is not
 * decoration: it is what makes switching organizations safe. The active id is
 * part of the key, so a switch produces cache misses rather than serving the
 * previous tenant's rows under the new one — and `queryClient.removeQueries`
 * isn't needed on the switch path at all.
 *
 * Account-scoped keys (`/me`, `/organizations`) and unauthenticated keys
 * (public event, pass) sit outside that prefix because they do not vary by
 * organization.
 */

/** Serialisable query parameters — part of the key so each filter caches apart. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

type OrgId = string | null | undefined;

export const queryKeys = {
  me: () => ['me'] as const,
  meContext: (organizationId: OrgId) => ['me', 'context', organizationId ?? null] as const,

  organizations: () => ['organizations'] as const,
  organization: (id: string) => ['organizations', id] as const,
  members: (id: string) => ['organizations', id, 'members'] as const,
  invitations: (id: string) => ['organizations', id, 'invitations'] as const,

  events: (organizationId: OrgId, params?: QueryParams) =>
    ['org', organizationId ?? null, 'events', 'list', params ?? {}] as const,
  eventsSummary: (organizationId: OrgId) =>
    ['org', organizationId ?? null, 'events', 'summary'] as const,
  eventsCalendar: (organizationId: OrgId, month: string) =>
    ['org', organizationId ?? null, 'events', 'calendar', month] as const,
  event: (organizationId: OrgId, id: string) =>
    ['org', organizationId ?? null, 'events', 'detail', id] as const,
  checkinState: (organizationId: OrgId, id: string) =>
    ['org', organizationId ?? null, 'events', 'detail', id, 'checkin-state'] as const,

  people: (organizationId: OrgId, params?: QueryParams) =>
    ['org', organizationId ?? null, 'people', 'list', params ?? {}] as const,
  peopleSummary: (organizationId: OrgId, eventId?: string) =>
    ['org', organizationId ?? null, 'people', 'summary', eventId ?? null] as const,
  person: (organizationId: OrgId, id: string) =>
    ['org', organizationId ?? null, 'people', 'detail', id] as const,

  publicEvent: (id: string) => ['public', 'events', id] as const,
  pass: (token: string) => ['pass', token] as const,
} as const;


/** Every event-derived cache entry: lists, summary, calendar, detail. */
export const eventsScope = (organizationId: OrgId) =>
  ['org', organizationId ?? null, 'events'] as const;

/** Every person-derived cache entry. */
export const peopleScope = (organizationId: OrgId) =>
  ['org', organizationId ?? null, 'people'] as const;
