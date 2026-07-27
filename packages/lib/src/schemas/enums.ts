// ============================================================================
// FILE: packages/lib/src/schemas/enums.ts
// Zod mirrors of the Postgres enums in ./tables/enums.ts
// ============================================================================

import { z } from 'zod';

/**
 * These mirror `tables/enums.ts` one-for-one. When they drifted from it — and
 * they had — the result was validators that accepted values the database would
 * reject, which is worse than no validator at all.
 *
 * Changed by the rebuild:
 *   · no `draft` event status, and no stored status at all (see below)
 *   · `member` role became `organizer`, and `checkin` is new
 *   · `external_auth` check-in is gone (D-I: rejected); `self` and `pass` are new
 */

/**
 * The four states an event can be in.
 *
 * **Not a column.** `events` has no `status`; the API derives this from
 * `(cancelled_at, closed_at, start_at, end_at, now)` on every read. A status
 * that cannot be stored cannot go stale — which is exactly what the old column
 * did, reporting `scheduled` for events that had already finished.
 */
export const EventStatusEnum = z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']);
export type EventStatus = z.infer<typeof EventStatusEnum>;

// Organization plan enum
export const OrgPlanEnum = z.enum(['free', 'starter', 'pro', 'enterprise']);
export type OrgPlan = z.infer<typeof OrgPlanEnum>;

/** `owner ⊃ admin ⊃ organizer ⊃ checkin`; `viewer` is a separate read-only branch. */
export const OrgRoleEnum = z.enum(['owner', 'admin', 'organizer', 'checkin', 'viewer']);
export type OrgRole = z.infer<typeof OrgRoleEnum>;


/** How a check-in happened. */
export const CheckInMethodEnum = z.enum(['qr', 'manual', 'self', 'pass']);
export type CheckInMethod = z.infer<typeof CheckInMethodEnum>;

/**
 * What an attendance row records. Replaces the `attended` boolean and the
 * render-time no-show inference — `no_show` is a written fact now, set once when
 * an event closes, so it can be corrected and audited.
 */
export const AttendanceStateEnum = z.enum(['registered', 'attended', 'no_show', 'cancelled']);
export type AttendanceState = z.infer<typeof AttendanceStateEnum>;
