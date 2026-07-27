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

import type { OrgRole, Permission } from '../authz/permissions';
import { ROLE_PERMISSIONS } from '../authz/permissions';

declare const brand: unique symbol;

export interface TenantContext {
  readonly [brand]: 'verified';
  readonly organizationId: string;
  readonly accountId: string;
  readonly role: OrgRole | null;
  readonly permissions: ReadonlySet<Permission>;
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
  accountId: string;
  role: OrgRole | null;
}

/**
 * The ONLY constructor. Call it from the tenant middleware, after the caller's
 * membership has been read from the database — never from a route handler.
 *
 * Enforced by the eslint `no-restricted-imports` rule in eslint.config.mjs:
 * `src/routes/**` may not import from `src/tenancy/context`.
 */
export function createTenantContext(input: TenantContextInput): TenantContext {
  return {
    organizationId: input.organizationId,
    accountId: input.accountId,
    role: input.role,
    permissions: input.role ? ROLE_PERMISSIONS[input.role] : new Set<Permission>(),
  } as TenantContext;
}

export function createAccountContext(accountId: string): AccountContext {
  return { accountId } as AccountContext;
}

/**
 * Org-wide permission check, and the only one there is.
 *
 * There was a second — `canOnEvent`, backed by an `event_grants` table giving a
 * caller extra permissions on one event. Nothing ever populated the map it read,
 * so it returned false for every grant that was supposed to widen access. A
 * permanently-empty authorization surface is worse than no surface, because it
 * reads as working. Both are deleted (D24 / plan §4c).
 */
export const can = (ctx: TenantContext, permission: Permission): boolean =>
  ctx.permissions.has(permission);
