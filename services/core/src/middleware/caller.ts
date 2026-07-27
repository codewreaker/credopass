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
import { loadMemberships, resolveCaller, type Caller } from '../services/identity';
import { ensureDefaultOrganization } from '../services/membership';
import { createTenantContext, type TenantContext } from '../tenancy/context';
import { getDatabase } from '../db/client';
import * as Device from '../services/device';
import type { Permission } from '../authz/permissions';
import { can } from '../tenancy/context';

export interface CallerVars {
  /** Present for a human caller. Absent for a device. */
  caller: Caller;
  /** Present for a device caller. Absent for a human. */
  device: Device.VerifiedDevice;
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

  const db = await getDatabase();

  // A device token is a different KIND of caller, not a weaker human one.
  // Recognised by prefix so the two paths never overlap: a JWT can never be
  // mistaken for a device credential, and a device token is never handed to
  // the JWT verifier (whose failure mode is a flat 401 that would hide
  // "revoked", which an operator needs to see).
  if (token.startsWith(Device.DEVICE_TOKEN_PREFIX)) {
    c.set('device', await Device.verifyToken(db, token));
    await next();
    return;
  }

  const verified = await getRegistry().verify(token);
  if (!verified) throw problem.unauthenticated('The token could not be verified.');
  const caller = await resolveCaller(db, {
    issuer: verified.issuer,
    subject: verified.subject,
    claims: verified.claims,
    providerKind: verified.trusted.providerKind,
  });

  // Give a brand-new account its own organisation, so nobody lands in a console
  // where every query is correctly empty. The zero-membership test is what keeps
  // this off the hot path: it is true exactly once per account, and false on
  // every request afterwards, so the transaction and its advisory lock are not
  // paid for by steady-state traffic.
  //
  // Guests are excluded. Nothing issues anonymous tokens any more, but the API
  // still accepts them, and provisioning an organisation for a caller who may
  // never return is what D16 exists to forbid.
  if (caller.memberships.length === 0 && !caller.isGuest) {
    await ensureDefaultOrganization(db, {
      id: caller.accountId,
      displayName: caller.displayName,
      email: caller.email,
    });

    // Re-read unconditionally. The membership list above was read BEFORE the
    // lock, so it is stale either way: this request may have created the
    // organisation, or it may have lost the race to a sibling that did. The
    // losing case is the one that matters — it returns null, and without a
    // re-read this request would carry on with no memberships and 403 on every
    // org-scoped route it touches.
    caller.memberships = await loadMemberships(db, caller.accountId);
  }

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
  const device = c.get('device');

  // A device's tenant comes from its own row, never from a header — it has no
  // memberships to validate a header against, and letting it name an
  // organisation would be exactly the escalation device tokens prevent.
  if (device) {
    const eventInPath = c.req.param('id') ?? c.req.param('eventId');
    if (eventInPath) Device.assertEventInScope(device, eventInPath);

    c.set(
      'tenant',
      createTenantContext({
        organizationId: device.organizationId,
        accountId: null,
        deviceId: device.deviceId,
        // A device acts with the `checkin` role, then INTERSECTED with its own
        // scope list. Neither alone is enough: the role bounds what the product
        // allows a door to do, the scopes bound what this token was issued for.
        role: 'checkin',
        deviceScopes: device.scopes,
      })
    );
    await next();
    return;
  }

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
