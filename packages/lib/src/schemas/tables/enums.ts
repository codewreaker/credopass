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
 * `checkin` is new — a door tablet's operator should not be able to edit events.
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
 * Event-scoped delegation (§6.3). An `event_grants` row ADDS permissions on one
 * event; it never removes org-level ones.
 */
export const eventRole = pgEnum('event_role', ['organizer', 'co_host', 'staff']);

/**
 * How a membership came to exist. SCIM-ready from day one so adding it later is
 * an endpoint rather than a migration (D1).
 */
export const provisionedBy = pgEnum('provisioned_by', ['manual', 'jit', 'scim']);

/** Which kind of identity provider issued an identity. */
export const identityProviderKind = pgEnum('identity_provider_kind', ['oidc', 'saml']);
