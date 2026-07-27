/**
 * Contract types, derived — never hand-written.
 *
 * Named component schemas (`Event`, `Person`, …) come straight out of
 * `generated/schema.d.ts`. Everything else — paginated envelopes, summary
 * tiles, the pairing response — is inline in the OpenAPI document, so it is
 * pulled out of `paths` with the helpers below rather than restated here. A
 * server-side shape change then surfaces as a type error at the call site,
 * which is the whole reason the client is generated.
 */

import type { components, paths } from './generated/schema';

// ============================================================================
// Extraction helpers
// ============================================================================

type JsonBody<T> = T extends { content: { 'application/json': infer C } } ? C : never;

/** The 2xx JSON body of an operation. */
export type ApiResponse<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: infer R;
}
  ? JsonBody<R[Extract<keyof R, 200 | 201 | 202>]>
  : never;

/** The JSON request body of an operation. */
export type ApiBody<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: infer B;
}
  ? JsonBody<NonNullable<B>>
  : never;

/** The query-string parameters of an operation. */
export type ApiQuery<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  parameters: { query?: infer Q };
}
  ? NonNullable<Q>
  : never;

// ============================================================================
// Identity
// ============================================================================

export type Account = components['schemas']['Account'];
export type MeContext = components['schemas']['MeContext'];
export type OrgSummary = components['schemas']['OrgSummary'];

/**
 * The permission strings `/me/context` ships in `membership.permissions`.
 *
 * Render from this list; never re-derive it from the role. The role→permission
 * matrix lives server-side in `services/core/src/authz/permissions.ts` and is
 * the only place it may live (§2.7 convention 1).
 *
 * Read off the response that actually carries them. It used to be read off the
 * device-pairing REQUEST body — the one place a permission was ever named in a
 * request — which meant deleting device tokens (D24) would have deleted this
 * type. `/me/context` now declares the enum directly, which is both stabler and
 * more honest: the field ships a closed set, so the contract says so.
 */
export type Permission = NonNullable<
  NonNullable<MeContext['membership']>['permissions']
>[number];

export type Role = components['schemas']['Member']['role'];

// ============================================================================
// Organizations
// ============================================================================

export type Organization = components['schemas']['Organization'];
export type Member = components['schemas']['Member'];
export type Invitation = components['schemas']['Invitation'];
export type InvitationCreated = ApiResponse<'/organizations/{id}/invitations', 'post'>;

// ============================================================================
// Events
// ============================================================================

export type Event = components['schemas']['EventSummary'];
export type EventStatus = Event['status'];
export type EventListQuery = ApiQuery<'/events', 'get'>;
export type EventList = ApiResponse<'/events', 'get'>;
export type EventsSummary = ApiResponse<'/events/summary', 'get'>;
export type EventCalendar = ApiResponse<'/events/calendar', 'get'>;
export type EventCreate = ApiBody<'/events', 'post'>;
export type EventUpdate = ApiBody<'/events/{id}', 'patch'>;
export type CheckInMethod = NonNullable<EventCreate['checkInMethods']>[number];

// ============================================================================
// People
// ============================================================================

export type PersonRow = components['schemas']['PersonRow'];
export type Person = components['schemas']['Person'];
export type PersonCreated = components['schemas']['PersonCreated'];
export type Standing = PersonRow['standing'];
export type PeopleListQuery = ApiQuery<'/people', 'get'>;
export type PeopleList = ApiResponse<'/people', 'get'>;
export type PeopleSummary = ApiResponse<'/people/summary', 'get'>;
export type PersonCreate = ApiBody<'/people', 'post'>;
export type PersonUpdate = ApiBody<'/people/{id}', 'patch'>;

// ============================================================================
// Attendance
// ============================================================================

export type AttendanceResult = components['schemas']['AttendanceResult'];
export type RegisterBody = ApiBody<'/events/{id}/register', 'post'>;
export type RegisterResult = ApiResponse<'/events/{id}/register', 'post'>;
export type CheckInBody = ApiBody<'/events/{id}/check-in', 'post'>;
export type CheckOutBody = ApiBody<'/events/{id}/check-out', 'post'>;
export type CheckInState = ApiResponse<'/events/{id}/checkin-state', 'get'>;
export type CloseResult = ApiResponse<'/events/{id}/close', 'post'>;

// ============================================================================
// Analytics
// ============================================================================

/**
 * Check `fabricated` before rendering any of this. It is true while the figures
 * are placeholders, and the server is the only thing that decides — a client
 * that hard-codes "sample data" into its banner will still be lying on the day
 * the numbers become real.
 */
export type Analytics = components['schemas']['Analytics'];
export type AnalyticsQuery = ApiQuery<'/analytics/overview', 'get'>;
export type AnalyticsRange = NonNullable<AnalyticsQuery['range']>;
export type StatTile = Analytics['stats'][number];
export type SeriesPoint = Analytics['attendanceTrend'][number];

// ============================================================================
// Billing
// ============================================================================

export type Plan = components['schemas']['Plan'];
export type PlanId = Plan['id'];
export type PlanChange = components['schemas']['PlanChange'];

// ============================================================================
// Public / pass
// ============================================================================

export type PublicEvent = components['schemas']['PublicEvent'];
export type PassView = components['schemas']['PassView'];
export type PublicRegisterResult = ApiResponse<'/public/events/{id}/register', 'post'>;
export type PublicCheckInResult = ApiResponse<'/public/events/{id}/check-in', 'post'>;
