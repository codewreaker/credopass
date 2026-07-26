/**
 * `TenantContext` — non-forgeable proof that a caller's org membership was
 * verified. docs/API-FIRST-REBUILD.md §7.1.
 *
 * The type carries a private brand backed by a module-local `unique symbol`.
 * Nothing outside this file can produce a value that satisfies the type: a
 * handler cannot write `{ organizationId: req.body.orgId } as TenantContext`
 * without an explicit cast, and casts to a branded type are what code review
 * and the lint rule below look for.
 *
 * Rule 1 of the five structural rules: the tenant comes from the token, never
 * the payload. This is the mechanism.
 */

import type { EventRole, OrgRole, Permission } from '../authz/permissions';
import { EVENT_ROLE_PERMISSIONS, ROLE_PERMISSIONS } from '../authz/permissions';

declare const brand: unique symbol;

export interface TenantContext {
  readonly [brand]: 'verified';
  readonly organizationId: string;
  readonly accountId: string | null;
  readonly deviceId: string | null;
  readonly role: OrgRole | null;
  readonly permissions: ReadonlySet<Permission>;
  /** eventId → the caller's role on that specific event (§6.3). */
  readonly eventGrants: ReadonlyMap<string, EventRole>;
  /**
   * A device token's explicit scope list, or null for account callers. Kept on
   * the context so it can cap event-grant permissions too — without it, a grant
   * would let a door tablet exceed the scopes it was issued.
   */
  readonly deviceScopes: ReadonlySet<Permission> | null;
}

/**
 * The self-scoped counterpart. `GET /me/tickets` and friends are
 * `scope: 'account'`: they take no organization at all and read only rows where
 * `people.account_id` is the caller (§5.1).
 *
 * It is a SEPARATE type on purpose — not a TenantContext with a null org. A
 * function that needs a tenant cannot accidentally accept one of these, which
 * is half of the structural guarantee that attending never grants belonging.
 */
export interface AccountContext {
  readonly [brand]: 'verified';
  readonly accountId: string;
}

export interface TenantContextInput {
  organizationId: string;
  accountId: string | null;
  deviceId?: string | null;
  role: OrgRole | null;
  /**
   * Device tokens carry an explicit scope list. When present it is an
   * INTERSECTION with the role's permissions, never additive beyond its own
   * list (§6.3) — a stolen door tablet cannot exceed what it was issued.
   */
  deviceScopes?: readonly Permission[] | null;
  eventGrants?: ReadonlyMap<string, EventRole>;
}

/**
 * The ONLY constructor. Call it from the tenant middleware, after the caller's
 * membership has been read from the database — never from a route handler.
 *
 * Enforced by the eslint `no-restricted-imports` rule in eslint.config.mjs:
 * `src/routes/**` may not import from `src/tenancy/context`.
 */
export function createTenantContext(input: TenantContextInput): TenantContext {
  const rolePermissions = input.role
    ? ROLE_PERMISSIONS[input.role]
    : new Set<Permission>();

  const eventGrants = input.eventGrants ?? new Map<string, EventRole>();

  // Event grants add permissions on their own event. They are stored per-event
  // and consulted by `canOnEvent`; the flat `permissions` set stays org-level so
  // a grant on one event can never be mistaken for org-wide authority.
  const deviceScopes = input.deviceScopes ? new Set(input.deviceScopes) : null;

  const effective: ReadonlySet<Permission> = deviceScopes
    ? new Set([...rolePermissions].filter((p) => deviceScopes.has(p)))
    : rolePermissions;

  return {
    organizationId: input.organizationId,
    accountId: input.accountId,
    deviceId: input.deviceId ?? null,
    role: input.role,
    permissions: effective,
    eventGrants,
    deviceScopes,
  } as TenantContext;
}

export function createAccountContext(accountId: string): AccountContext {
  return { accountId } as AccountContext;
}

/** Org-wide permission check. */
export const can = (ctx: TenantContext, permission: Permission): boolean =>
  ctx.permissions.has(permission);

/**
 * Permission check for one event: org-level permissions ∪ the permissions this
 * caller's `event_grants` row adds for that event (§6.3).
 */
export function canOnEvent(
  ctx: TenantContext,
  eventId: string,
  permission: Permission
): boolean {
  if (ctx.permissions.has(permission)) return true;
  const grant = ctx.eventGrants.get(eventId);
  if (!grant) return false;
  if (!EVENT_ROLE_PERMISSIONS[grant].has(permission)) return false;
  // A device token's scope list caps everything, event grants included: a
  // tablet issued {checkin:record} must not reach `event:update` by way of a
  // grant on the event it is paired to.
  if (ctx.deviceScopes && !ctx.deviceScopes.has(permission)) return false;
  return true;
}
