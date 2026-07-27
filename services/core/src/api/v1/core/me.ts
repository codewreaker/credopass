/**
 * The account scope: /me and /me/context.
 * docs/API-FIRST-REBUILD.md §5.1
 *
 * These are `scope: 'account'` — self-scoped. They take no X-Organization-Id,
 * they never consult a tenant, and they read only rows belonging to the caller.
 * That is why they declare no permission: there is no org whose role could
 * grant or withhold access to your own record.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { defineRoute, problemResponse } from '../../../http/define-route';
import { requireCaller, type CallerVars } from '../../../middleware/caller';
import { ROLE_PERMISSIONS } from '../../../authz/permissions';

export const me = new OpenAPIHono<{ Variables: CallerVars }>();

// Scoped to these paths, NOT '*'. This sub-app is mounted at the root so its
// paths read as /me and /me/context, which means a wildcard here would put auth
// on /health, /docs and /openapi.json too — and a health probe that returns 401
// takes the service out of the load balancer. Two matchers because Hono's
// '/me/*' does not match '/me' itself.
me.use('/me', requireCaller);
me.use('/me/*', requireCaller);

const AccountSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().nullable(),
    displayName: z.string().nullable(),
    isGuest: z.boolean(),
  })
  .openapi('Account');

const OrgSummarySchema = z
  .object({
    id: z.string().uuid(),
    role: z.string(),
  })
  .openapi('OrgSummary');

const MeContextSchema = z
  .object({
    account: AccountSchema,
    organizations: z.array(OrgSummarySchema),
    activeOrganization: z.union([OrgSummarySchema, z.null()]),
    membership: z
      .object({ role: z.string(), permissions: z.array(z.string()) })
      .nullable(),
    needsOnboarding: z.boolean(),
  })
  .openapi('MeContext');

me.openapi(
  defineRoute({
    method: 'get',
    path: '/me',
    scope: 'account',
    summary: 'The signed-in account',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'The caller', content: { 'application/json': { schema: AccountSchema } } },
      401: problemResponse('No valid token'),
    },
  }),
  (c) => {
    const caller = c.get('caller');
    return c.json(
      {
        id: caller.accountId,
        email: caller.email,
        displayName: caller.displayName,
        isGuest: caller.isGuest,
      },
      200
    );
  }
);

/**
 * The first call every screen makes.
 *
 * `organizations` lists the caller's MEMBERSHIPS and nothing else — which is
 * the fix for the leak where OrgSelector listed every organisation in the
 * database and auto-selected the first (T1, §10.7).
 *
 * `needsOnboarding` is true when the caller belongs to nothing. The web app
 * renders "Create your organisation" rather than someone else's data — without
 * it, enforcing tenancy would leave a new account staring at an empty console
 * with no way forward (D-A).
 */
me.openapi(
  defineRoute({
    method: 'get',
    path: '/me/context',
    scope: 'account',
    summary: 'Account, memberships, active org and effective permissions',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    request: {
      headers: z.object({
        'x-organization-id': z.string().uuid().optional(),
      }),
    },
    responses: {
      200: { description: 'Bootstrap context', content: { 'application/json': { schema: MeContextSchema } } },
      401: problemResponse('No valid token'),
    },
  }),
  (c) => {
    const caller = c.get('caller');
    const organizations = caller.memberships.map((m) => ({
      id: m.organizationId,
      role: m.role,
    }));

    const requested = c.req.header('X-Organization-Id');
    const active =
      organizations.find((o) => o.id === requested) ??
      (organizations.length === 1 ? organizations[0] : null);

    // Permissions are decided here, server-side, and shipped to the client as a
    // flat list. The client renders from them; it never derives them (rule 5).
    const permissions = active
      ? [...ROLE_PERMISSIONS[caller.memberships.find((m) => m.organizationId === active.id)!.role]]
      : [];

    return c.json({
      account: {
        id: caller.accountId,
        email: caller.email,
        displayName: caller.displayName,
        isGuest: caller.isGuest,
      },
      organizations,
      activeOrganization: active,
      membership: active ? { role: active.role, permissions } : null,
      needsOnboarding: organizations.length === 0,
    }, 200);
  }
);
