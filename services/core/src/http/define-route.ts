/**
 * `defineRoute` — the single act of registering a route.
 *
 * Registering with the OpenAPI app and declaring the authorization contract are
 * the SAME call, so there is no way to add an endpoint and forget the second
 * half. Rule 2 of the five structural rules (§1.1): every route declares a
 * scope and a permission, and an undeclared route is a boot failure.
 *
 * Rule 4 rides along for free: the OpenAPI document is emitted from these same
 * Zod schemas, so there is no hand-written spec to drift (D14).
 */

import { createRoute, type RouteConfig } from '@hono/zod-openapi';
import type { Permission, RouteScope } from '../authz/permissions';
import { declareRoute, type HttpMethod } from './route-registry';
import { PROBLEM_CONTENT_TYPE } from './problem';
import { z } from '@hono/zod-openapi';

/** The problem+json body, as an OpenAPI schema. */
export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: z.string(),
    errors: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
  })
  .openapi('Problem');

/** Shorthand for an error response in a route's `responses` map. */
export const problemResponse = (description: string) => ({
  description,
  content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } },
});

type ScopeDeclaration =
  | { scope: 'organization'; permission: Permission }
  | { scope: Exclude<RouteScope, 'organization'>; permission?: never };

/**
 * Build a route config, recording its authorization contract as a side effect.
 *
 * The `ScopeDeclaration` union makes the common mistake a TYPE error rather than
 * a runtime one: `scope: 'organization'` without a permission does not compile,
 * and a permission on a public route does not compile either. The boot
 * assertion (§6.4) stays as the runtime backstop for anything that reaches the
 * registry another way — a cast, a dynamically built route, a future refactor.
 *
 * The generics mirror `createRoute`'s exactly, and are load-bearing: they carry
 * the request/response schema types through to the handler so `c.req.valid()`
 * stays typed. Returning a plain `RouteConfig` here would widen everything to
 * `never` at the call site — a wrapper that silently costs you type safety is
 * worse than no wrapper.
 */
export function defineRoute<
  P extends string,
  R extends Omit<RouteConfig, 'path'> & { path: P },
>(config: R & ScopeDeclaration): ReturnType<typeof createRoute<P, R>> {
  const { scope, permission, ...routeConfig } = config;

  declareRoute({
    method: routeConfig.method as HttpMethod,
    path: routeConfig.path,
    scope,
    ...(permission ? { permission } : {}),
    ...(routeConfig.summary ? { summary: routeConfig.summary } : {}),
  });

  return createRoute(routeConfig as unknown as R);
}
