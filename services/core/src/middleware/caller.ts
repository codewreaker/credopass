/**
 * Auth and tenant resolution for /api/v1/core.
 * docs/API-FIRST-REBUILD.md §5.0, §6.4, §7.1
 *
 * Two middlewares, in order:
 *
 *   requireCaller  — verify the bearer token, resolve (iss, sub) → account
 *   requireTenant  — read X-Organization-Id, validate it against the caller's
 *                    memberships, and build the branded TenantContext
 *
 * The second is the ONLY place a TenantContext is constructed. Route handlers
 * receive one; eslint blocks them from importing the constructor.
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { problem, ProblemCode } from '../http/problem';
import { createIssuerRegistry, type IssuerRegistry } from '../identity/issuer-registry';
import { resolveCaller, type Caller } from '../services/identity';
import { createTenantContext, type TenantContext } from '../tenancy/context';
import { getDatabase } from '../db/client';
import type { Permission } from '../authz/permissions';
import { can } from '../tenancy/context';

export interface CallerVars {
  caller: Caller;
  tenant: TenantContext;
}

let registry: IssuerRegistry | null = null;
const getRegistry = (): IssuerRegistry => (registry ??= createIssuerRegistry());

/** Test seam: swap the registry for one with a fake issuer. */
export const setIssuerRegistry = (r: IssuerRegistry | null): void => {
  registry = r;
};

const bearer = (c: Context): string | null => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};

/**
 * Verify the token and resolve the caller.
 *
 * Every failure answers a flat 401. Distinguishing "no such issuer" from "bad
 * signature" from "expired" tells an attacker which part to work on, and tells
 * a legitimate client nothing it can act on.
 */
export const requireCaller = createMiddleware<{ Variables: CallerVars }>(async (c, next) => {
  const token = bearer(c);
  if (!token) throw problem.unauthenticated('A bearer token is required.');

  const verified = await getRegistry().verify(token);
  if (!verified) throw problem.unauthenticated('The token could not be verified.');

  const db = await getDatabase();
  const caller = await resolveCaller(db, {
    issuer: verified.issuer,
    subject: verified.subject,
    claims: verified.claims,
    providerKind: verified.trusted.providerKind,
  });

  c.set('caller', caller);
  await next();
});

/**
 * Choose the active organisation and build the TenantContext.
 *
 * The rules, stated once (§7.1):
 *   · header present    → must be one of the caller's memberships, else 403
 *   · absent, one org   → that one
 *   · absent, several   → 400 organization_required
 *   · absent, none      → 403; the caller needs onboarding, and every
 *                         org-scoped endpoint is meaningless until they have one
 *
 * The tenant NEVER comes from a body or query parameter. That is rule 1, and
 * it is the reason T5 passes.
 */
export interface TenantOptions {
  /**
   * Name of a path parameter carrying the organisation id, e.g. `id` for
   * `/organizations/{id}/members`.
   *
   * This does NOT weaken rule 1. The rule is that a tenant id must be validated
   * against the caller's memberships before it means anything — which happens
   * below, identically, whichever place the id came from. What the rule forbids
   * is trusting an id from a request BODY, where it would silently override the
   * org the caller actually authenticated for.
   *
   * Without this, `GET /organizations/{id}` would 400 for anyone in more than
   * one organisation unless they also sent a header naming the org already in
   * the URL.
   */
  fromPathParam?: string;
}

export const requireTenant = (options: TenantOptions = {}) =>
  createMiddleware<{ Variables: CallerVars }>(async (c, next) => {
  const caller = c.get('caller');
  if (!caller) throw problem.unauthenticated();

  const fromPath = options.fromPathParam ? c.req.param(options.fromPathParam) : undefined;
  const requested = fromPath ?? c.req.header('X-Organization-Id');
  const active = caller.memberships;

  let membership;

  if (requested) {
    membership = active.find((m) => m.organizationId === requested);
    if (!membership) {
      // A header naming someone else's org is a 403: the caller asserted a
      // tenant and is being told they are not in it (T2).
      //
      // A PATH naming someone else's org is a 404: the resource is addressed
      // directly, and confirming it exists would leak that another tenant owns
      // it (T3, §5.0 "not-found vs forbidden").
      if (fromPath) {
        throw problem.notFound(ProblemCode.NOT_FOUND, 'Organization not found.');
      }
      throw problem.forbidden(
        ProblemCode.NOT_A_MEMBER,
        'You are not a member of that organization.'
      );
    }
  } else if (active.length === 1) {
    membership = active[0];
  } else if (active.length === 0) {
    throw problem.forbidden(
      ProblemCode.NOT_A_MEMBER,
      'This account belongs to no organization yet.'
    );
  } else {
    throw problem.badRequest(
      ProblemCode.ORGANIZATION_REQUIRED,
      'Several organizations are available; send X-Organization-Id to choose one.'
    );
  }

  c.set(
    'tenant',
    createTenantContext({
      organizationId: membership.organizationId,
      accountId: caller.accountId,
      role: membership.role,
    })
  );

  await next();
});

/**
 * Assert a permission. Pairs with the route's `defineRoute` declaration — the
 * declaration is what the boot assertion checks; this is what actually runs.
 */
export const requirePermission = (permission: Permission) =>
  createMiddleware<{ Variables: CallerVars }>(async (c, next) => {
    const tenant = c.get('tenant');
    if (!tenant) throw problem.unauthenticated();
    if (!can(tenant, permission)) {
      throw problem.forbidden(
        ProblemCode.INSUFFICIENT_PERMISSION,
        `This action requires ${permission}.`
      );
    }
    await next();
  });
