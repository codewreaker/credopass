/**
 * Structural assertions — test T25 and its neighbours (§7.3, §12.1).
 *
 * These make a CLASS of bug impossible rather than catching one instance: a
 * route that forgets its authorization contract cannot reach production because
 * the service will not boot. No database required, so they run everywhere.
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import {
  assertRouteRegistryComplete,
  declareRoute,
  getRouteDeclarations,
  resetRouteRegistry,
  RouteRegistryError,
  type RouteDeclaration,
} from '../http/route-registry';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../authz/permissions';

// Importing the API registers its routes as a side effect. Snapshot them at
// module load — BEFORE any beforeEach clears the registry, which is global.
import '../api/v1/core';
const LIVE_ROUTES = getRouteDeclarations();

describe('route registry — the boot assertion (T25)', () => {
  beforeEach(() => resetRouteRegistry());

  it('accepts an organization route that declares a permission', () => {
    const routes: RouteDeclaration[] = [
      { method: 'patch', path: '/events/{id}', scope: 'organization', permission: 'event:update' },
    ];
    expect(() => assertRouteRegistryComplete(routes)).not.toThrow();
  });

  it('THROWS when an organization route declares no permission', () => {
    const routes = [
      { method: 'get', path: '/events', scope: 'organization' },
    ] as unknown as RouteDeclaration[];

    expect(() => assertRouteRegistryComplete(routes)).toThrow(RouteRegistryError);
    try {
      assertRouteRegistryComplete(routes);
    } catch (e) {
      expect((e as RouteRegistryError).violations[0]).toContain('declares no permission');
    }
  });

  it('THROWS when a route declares no scope at all', () => {
    const routes = [{ method: 'get', path: '/events' }] as unknown as RouteDeclaration[];
    expect(() => assertRouteRegistryComplete(routes)).toThrow(RouteRegistryError);
  });

  it('THROWS when a public route declares a permission', () => {
    // The asymmetric case: this means the author thought a self-scoped route was
    // tenant-scoped, which usually means they scoped something else wrong too.
    const routes = [
      { method: 'get', path: '/public/events/{id}', scope: 'public', permission: 'event:read' },
    ] as unknown as RouteDeclaration[];

    expect(() => assertRouteRegistryComplete(routes)).toThrow(RouteRegistryError);
    try {
      assertRouteRegistryComplete(routes);
    } catch (e) {
      expect((e as RouteRegistryError).violations[0]).toContain("only scope:'organization'");
    }
  });

  it('THROWS when an account route declares a permission', () => {
    const routes = [
      { method: 'get', path: '/me/tickets', scope: 'account', permission: 'attendance:read' },
    ] as unknown as RouteDeclaration[];
    expect(() => assertRouteRegistryComplete(routes)).toThrow(RouteRegistryError);
  });

  it('THROWS on an unknown permission string', () => {
    const routes = [
      { method: 'post', path: '/events/{id}/publish', scope: 'organization', permission: 'event:publish' },
    ] as unknown as RouteDeclaration[];

    // event:publish was removed with `draft` (D2). Reintroducing it by hand
    // fails here rather than silently granting nothing at runtime.
    expect(() => assertRouteRegistryComplete(routes)).toThrow(RouteRegistryError);
  });

  it('reports every violation at once, not just the first', () => {
    const routes = [
      { method: 'get', path: '/a', scope: 'organization' },
      { method: 'get', path: '/b', scope: 'public', permission: 'event:read' },
      { method: 'get', path: '/c' },
    ] as unknown as RouteDeclaration[];

    try {
      assertRouteRegistryComplete(routes);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as RouteRegistryError).violations).toHaveLength(3);
    }
  });

  it('refuses a duplicate declaration for the same method+path', () => {
    declareRoute({ method: 'get', path: '/events', scope: 'organization', permission: 'event:read' });
    expect(() =>
      declareRoute({ method: 'get', path: '/events', scope: 'organization', permission: 'event:create' })
    ).toThrow(/declared twice/);
  });
});

describe('the live registry', () => {
  it('every route mounted by the service passes the assertion', () => {
    expect(LIVE_ROUTES.length).toBeGreaterThan(0);
    expect(() => assertRouteRegistryComplete(LIVE_ROUTES)).not.toThrow();
  });

  it('every live route declares a scope', () => {
    for (const r of LIVE_ROUTES) {
      expect(r.scope, `${r.method.toUpperCase()} ${r.path}`).toBeDefined();
    }
  });
});

describe('permission vocabulary (§6.1)', () => {
  it('has exactly the 26 permissions the plan specifies', () => {
    expect(PERMISSIONS).toHaveLength(26);
  });

  it('does not contain event:publish — dropping `draft` removed it (D2)', () => {
    expect(PERMISSIONS as readonly string[]).not.toContain('event:publish');
  });

  it('owner ⊃ admin ⊃ organizer ⊃ checkin', () => {
    const { owner, admin, organizer, checkin } = ROLE_PERMISSIONS;
    for (const p of checkin) expect(organizer.has(p)).toBe(true);
    for (const p of organizer) expect(admin.has(p)).toBe(true);
    for (const p of admin) expect(owner.has(p)).toBe(true);
  });

  it('viewer is a read-only branch — it holds no write permission', () => {
    const writes = [...ROLE_PERMISSIONS.viewer].filter((p) =>
      /:(create|update|delete|record|amend|invite|remove|manage|upload|billing|cancel|update_role)$/.test(p)
    );
    expect(writes).toEqual([]);
  });

  it('viewer is NOT a subset of checkin, and checkin is NOT a subset of viewer', () => {
    // They are separate branches; asserting this stops someone "simplifying"
    // the matrix into a single chain and quietly granting viewers check-in.
    const { viewer, checkin } = ROLE_PERMISSIONS;
    expect([...viewer].every((p) => checkin.has(p))).toBe(false);
    expect([...checkin].every((p) => viewer.has(p))).toBe(false);
  });

  it('checkin cannot create people directly (§6.2 footnote 3)', () => {
    // Walk-ins go through AttendanceService, not POST /people. A door tablet's
    // credential must not be able to populate the org roll.
    expect(ROLE_PERMISSIONS.checkin.has('person:create')).toBe(false);
  });

  it('only owner holds org:delete and org:billing', () => {
    for (const role of ['admin', 'organizer', 'checkin', 'viewer'] as const) {
      expect(ROLE_PERMISSIONS[role].has('org:delete')).toBe(false);
      expect(ROLE_PERMISSIONS[role].has('org:billing')).toBe(false);
    }
    expect(ROLE_PERMISSIONS.owner.has('org:delete')).toBe(true);
    expect(ROLE_PERMISSIONS.owner.has('org:billing')).toBe(true);
  });
});
