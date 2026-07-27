// ============================================================================
// FILE: packages/lib/src/schemas/tables/enums.ts
// Postgres enum types shared by the rebuild's tables.
// docs/API-FIRST-REBUILD.md §6.1
// ============================================================================

import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Org roles (§6.2). `owner ⊃ admin ⊃ organizer ⊃ checkin`; `viewer` is a
 * separate read-only branch.
 *
 * Renamed from the old text column's values: `member` becomes `organizer`, and
 * `checkin` is new — it is the door role (D24), what someone working the
 * entrance signs in as. They record arrivals; they cannot edit the event.
 * The permission matrix lives in services/core/src/authz/permissions.ts and is
 * the only place that decides what a role may do.
 */
export const orgRole = pgEnum('org_role', [
  'owner',
  'admin',
  'organizer',
  'checkin',
  'viewer',
]);

/**
 * How a membership came to exist. SCIM-ready from day one so adding it later is
 * an endpoint rather than a migration (D1).
 */
export const provisionedBy = pgEnum('provisioned_by', ['manual', 'jit', 'scim']);

/** Which kind of identity provider issued an identity. */
export const identityProviderKind = pgEnum('identity_provider_kind', ['oidc', 'saml']);

/**
 * Attendance state (D8). Replaces the `attended` boolean AND the render-time
 * no-show inference — `no_show` is now a written fact, set once when an event
 * closes, so it can be corrected and audited.
 */
export const attendanceState = pgEnum('attendance_state', [
  'registered',
  'attended',
  'no_show',
  'cancelled',
]);

/** How a check-in happened. `external_auth` is deliberately absent (D-I: rejected). */
export const checkInMethod = pgEnum('check_in_method', ['qr', 'manual', 'self', 'pass']);
