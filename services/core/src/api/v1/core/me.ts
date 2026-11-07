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
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../../authz/permissions';
import { getDatabase } from '../../../db/client';
import { updateAccountDisplayName } from '../../../services/identity';

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
  })
  .openapi('Account');

const OrgSummarySchema = z
  .object({
    id: z.string().uuid(),
    // The name ships with the bootstrap context so no screen has to fetch
    // /organizations a second time just to label the active org. The composer's
    // "No organization" was that second request losing a race (B2).
    name: z.string(),
    role: z.string(),
  })
  .openapi('OrgSummary');

const MeContextSchema = z
  .object({
    account: AccountSchema,
    organizations: z.array(OrgSummarySchema),
    activeOrganization: z.union([OrgSummarySchema, z.null()]),
    membership: z
      // `z.enum(PERMISSIONS)`, not `z.string()`. This array is where the
      // permission vocabulary reaches the OpenAPI document, and therefore the
      // generated client's `Permission` union — the client used to read it off
      // the device-pairing request body, which disappeared with device tokens.
      // Naming the enum here is also simply more honest: the field ships a
      // closed set, so the contract should say so.
      .object({ role: z.string(), permissions: z.array(z.enum(PERMISSIONS)) })
      .nullable(),
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
 * There is no `needsOnboarding`. It used to say "this caller belongs to nothing,
 * send them to the onboarding wizard", but `ensureDefaultOrganization` gives
 * every account an organisation on its first authenticated request, so the field
 * was permanently false and the wizard permanently unreachable. Onboarding is
 * signing in (D22).
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
      name: m.organizationName,
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
      },
      organizations,
      activeOrganization: active,
      membership: active ? { role: active.role, permissions } : null,
    }, 200);
  }
);

/**
 * Edit your own account.
 *
 * The Profile tab said "Read-only for now — editing your profile isn't built
 * yet" because this did not exist (U4). It is `scope: 'account'` and declares
 * no permission for the same reason `GET /me` does not: the row is the
 * caller's, and no organisation role could grant or withhold it.
 *
 * `displayName` is the whole of it on purpose. Email is NOT editable here and
 * must not become so: an account is `(issuer, subject)` and `accounts.email` is
 * a MIRROR of what the provider asserted (D1). Letting someone type a different
 * address into it would make the mirror lie, and `uq_accounts_email` would then
 * reject or steal addresses depending on who got there first.
 *
 * Sending `null` clears the name, which puts the greeting back on the email
 * local part — a legitimate thing to want, and the reason the field is
 * nullable rather than required.
 */
me.openapi(
  defineRoute({
    method: 'patch',
    path: '/me',
    scope: 'account',
    summary: 'Update your own account',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z
              .object({
                displayName: z.union([z.string().trim().min(1).max(120), z.null()]),
              })
              .partial()
              .openapi('UpdateMeBody'),
          },
        },
      },
    },
    responses: {
      200: { description: 'The updated account', content: { 'application/json': { schema: AccountSchema } } },
      400: problemResponse('Validation failed'),
      401: problemResponse('No valid token'),
    },
  }),
  async (c) => {
    const caller = c.get('caller');
    const body = c.req.valid('json');

    // An empty PATCH is a no-op, not an error: it is what a form submits when
    // nothing changed.
    if (body.displayName === undefined) {
      return c.json(
        { id: caller.accountId, email: caller.email, displayName: caller.displayName },
        200
      );
    }

    const db = await getDatabase();
    const updated = await updateAccountDisplayName(db, caller.accountId, body.displayName);

    return c.json(
      { id: updated.id, email: updated.email, displayName: updated.displayName },
      200
    );
  }
);
