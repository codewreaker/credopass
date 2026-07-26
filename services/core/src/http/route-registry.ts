/**
 * The fail-closed hinge. docs/API-FIRST-REBUILD.md §6.4.
 *
 * Every route declares a scope, and `scope: 'organization'` additionally
 * declares a permission. At boot, `assertRouteRegistryComplete()` walks the
 * registry and THROWS if any declaration is missing or contradictory — so a
 * forgotten permission crashes the service on startup instead of becoming a
 * silent tenancy leak (test T25).
 *
 * The third check — a permission on a non-organization route — exists because
 * the failure mode is asymmetric. Forgetting a permission on an org route leaks
 * data; *adding* one to an account or public route means the author thought a
 * self-scoped route was tenant-scoped, which usually means they scoped it wrong
 * somewhere else too.
 */

import type { Permission, RouteScope } from '../authz/permissions';
import { isPermission, ROUTE_SCOPES } from '../authz/permissions';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteDeclaration {
  method: HttpMethod;
  path: string;
  scope: RouteScope;
  /** Required iff `scope === 'organization'`; forbidden otherwise. */
  permission?: Permission;
  /** Human summary, surfaced in the OpenAPI document. */
  summary?: string;
}

const registry = new Map<string, RouteDeclaration>();

const key = (method: HttpMethod, path: string) => `${method.toUpperCase()} ${path}`;

/**
 * Record a route's authorization contract. Called by every route module as it
 * registers with the OpenAPI app; the returned declaration is handed straight
 * back so a caller can inline it.
 */
export function declareRoute(decl: RouteDeclaration): RouteDeclaration {
  const k = key(decl.method, decl.path);
  const existing = registry.get(k);
  if (existing) {
    throw new Error(
      `Route registry: ${k} declared twice. A route has exactly one authorization contract.`
    );
  }
  registry.set(k, decl);
  return decl;
}

export function getRouteDeclarations(): readonly RouteDeclaration[] {
  return [...registry.values()];
}

/** Test-only: the registry is module-global, so suites must be able to reset it. */
export function resetRouteRegistry(): void {
  registry.clear();
}

export class RouteRegistryError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(
      `Route registry is incomplete — refusing to boot.\n` +
        violations.map((v) => `  · ${v}`).join('\n') +
        `\n\nEvery route must declare a scope, and scope:'organization' must declare ` +
        `exactly one permission. See docs/API-FIRST-REBUILD.md §6.4.`
    );
    this.name = 'RouteRegistryError';
    this.violations = violations;
  }
}

/**
 * Walk every registered route and throw on the first incomplete declaration.
 * Call this during boot, BEFORE the server starts listening.
 */
export function assertRouteRegistryComplete(
  routes: readonly RouteDeclaration[] = getRouteDeclarations()
): void {
  const violations: string[] = [];

  for (const r of routes) {
    const k = key(r.method, r.path);

    if (!r.scope) {
      violations.push(`${k} has no scope`);
      continue;
    }
    if (!(ROUTE_SCOPES as readonly string[]).includes(r.scope)) {
      violations.push(`${k} has unknown scope '${r.scope}'`);
      continue;
    }

    if (r.scope === 'organization') {
      if (!r.permission) {
        violations.push(`${k} is scope:'organization' but declares no permission`);
      } else if (!isPermission(r.permission)) {
        violations.push(`${k} declares unknown permission '${r.permission}'`);
      }
    } else if (r.permission) {
      violations.push(
        `${k} is scope:'${r.scope}' but declares permission '${r.permission}' — ` +
          `only scope:'organization' routes carry a permission`
      );
    }
  }

  if (violations.length > 0) throw new RouteRegistryError(violations);
}
