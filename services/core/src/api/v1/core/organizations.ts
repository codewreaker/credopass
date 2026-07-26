/**
 * Organisations, members and invitations. docs/API-FIRST-REBUILD.md §5.2
 *
 * Note the two different scopes in one file, and why:
 *
 *   · `POST /organizations` and `GET /organizations` are `scope: 'account'`.
 *     They cannot be org-scoped — you cannot require an active organisation in
 *     order to create your first one, or to list which ones you have. This is a
 *     correction to §5.2, which lists `GET /organizations` under `org:read`.
 *
 *   · Everything addressed as `/organizations/{id}/…` is `scope: 'organization'`
 *     and resolves the tenant from the path (see requireTenant's fromPathParam).
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { defineRoute, problemResponse } from '../../../http/define-route';
import {
  requireCaller,
  requirePermission,
  requireTenant,
  type CallerVars,
} from '../../../middleware/caller';
import { getDatabase } from '../../../db/client';
import { ORG_ROLES } from '../../../authz/permissions';
import * as Membership from '../../../services/membership';

export const organizations = new OpenAPIHono<{ Variables: CallerVars }>();

organizations.use('/organizations', requireCaller);
organizations.use('/organizations/*', requireCaller);
organizations.use('/invitations/*', requireCaller);

// Tenant resolution for every per-organisation route.
organizations.use('/organizations/:id', requireTenant({ fromPathParam: 'id' }));
organizations.use('/organizations/:id/*', requireTenant({ fromPathParam: 'id' }));

const RoleSchema = z.enum(ORG_ROLES);

const OrganizationSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    plan: z.string(),
    role: RoleSchema.optional(),
  })
  .openapi('Organization');

const MemberSchema = z
  .object({
    accountId: z.string().uuid(),
    email: z.string().nullable(),
    displayName: z.string().nullable(),
    role: RoleSchema,
    status: z.string(),
  })
  .openapi('Member');

const InvitationSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string(),
    role: RoleSchema,
    expiresAt: z.string(),
  })
  .openapi('Invitation');

const IdParam = z.object({ id: z.string().uuid() });

/**
 * Project a member row onto exactly the fields the schema declares.
 *
 * Explicit rather than spread-minus-a-field: a column added to `MemberRow`
 * later must be added here deliberately before it reaches a response. That is
 * how a `notes` or `phone` column stops leaking by accident.
 */
const toMemberResponse = (m: Membership.MemberRow) => ({
  accountId: m.accountId,
  email: m.email,
  displayName: m.displayName,
  role: m.role,
  status: m.status,
});

// ---------------------------------------------------------------------------
// Account scope
// ---------------------------------------------------------------------------

organizations.openapi(
  defineRoute({
    method: 'post',
    path: '/organizations',
    scope: 'account',
    summary: 'Create an organization (you become its owner)',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().uuid().optional(),
              name: z.string().min(1).max(200),
              slug: z.string().min(1).max(64).optional(),
              timezone: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: OrganizationSchema } } },
      400: problemResponse('Invalid body'),
      401: problemResponse('No valid token'),
      409: problemResponse('Slug already taken'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const org = await Membership.createOrganization(db, c.get('caller').accountId, c.req.valid('json'));
    return c.json(org, 201);
  }
);

organizations.openapi(
  defineRoute({
    method: 'get',
    path: '/organizations',
    scope: 'account',
    summary: "The caller's organizations — never every organization",
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Your organizations',
        content: { 'application/json': { schema: z.array(OrganizationSchema) } },
      },
      401: problemResponse('No valid token'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    return c.json(await Membership.listMyOrganizations(db, c.get("caller").accountId), 200);
  }
);

organizations.openapi(
  defineRoute({
    method: 'post',
    path: '/invitations/{token}/accept',
    scope: 'account',
    summary: 'Accept an invitation and join its organization',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ token: z.string().min(16) }) },
    responses: {
      200: {
        description: 'Joined',
        content: {
          'application/json': {
            schema: z.object({ organizationId: z.string().uuid(), role: RoleSchema }),
          },
        },
      },
      403: problemResponse('Issued to a different email address'),
      404: problemResponse('No such invitation'),
      410: problemResponse('Expired or already accepted'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const accountId = c.get('caller').accountId;
    const verified = await Membership.verifiedEmailsFor(db, accountId);
    const result = await Membership.acceptInvitation(
      db,
      accountId,
      verified,
      c.req.valid('param').token
    );
    return c.json(result, 200);
  }
);

// ---------------------------------------------------------------------------
// Organization scope
// ---------------------------------------------------------------------------

organizations.openapi(
  defineRoute({
    method: 'get',
    path: '/organizations/{id}',
    scope: 'organization',
    permission: 'org:read',
    summary: 'One organization',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    request: { params: IdParam },
    responses: {
      200: { description: 'The organization', content: { 'application/json': { schema: OrganizationSchema } } },
      404: problemResponse('Not found, or not yours'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    return c.json(await Membership.getOrganization(db, c.get("tenant").organizationId), 200);
  }
);

organizations.openapi(
  defineRoute({
    method: 'patch',
    path: '/organizations/{id}',
    scope: 'organization',
    permission: 'org:update',
    summary: 'Rename an organization',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('org:update')] as const,
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200).optional(),
              slug: z.string().min(1).max(64).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: OrganizationSchema } } },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or not yours'),
      409: problemResponse('Slug already taken'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const updated = await Membership.updateOrganization(
      db,
      c.get('tenant').organizationId,
      c.req.valid('json')
    );
    return c.json(updated, 200);
  }
);

organizations.openapi(
  defineRoute({
    method: 'delete',
    path: '/organizations/{id}',
    scope: 'organization',
    permission: 'org:delete',
    summary: 'Soft-delete an organization (refused while events exist)',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('org:delete')] as const,
    request: { params: IdParam },
    responses: {
      204: { description: 'Deleted' },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or not yours'),
      409: problemResponse('Still has events'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    await Membership.deleteOrganization(db, c.get('tenant').organizationId);
    return c.body(null, 204);
  }
);

organizations.openapi(
  defineRoute({
    method: 'get',
    path: '/organizations/{id}/members',
    scope: 'organization',
    permission: 'member:read',
    summary: 'Members of an organization',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('member:read')] as const,
    request: { params: IdParam },
    responses: {
      200: { description: 'Members', content: { 'application/json': { schema: z.array(MemberSchema) } } },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or not yours'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const members = await Membership.listMembers(db, c.get('tenant').organizationId);
    return c.json(members.map(toMemberResponse), 200);
  }
);

organizations.openapi(
  defineRoute({
    method: 'patch',
    path: '/organizations/{id}/members/{accountId}',
    scope: 'organization',
    permission: 'member:update_role',
    summary: "Change a member's role",
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('member:update_role')] as const,
    request: {
      params: z.object({ id: z.string().uuid(), accountId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({ role: RoleSchema }) } } },
    },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: MemberSchema } } },
      403: problemResponse('Insufficient role, or cannot act on an owner'),
      404: problemResponse('No such member'),
      409: problemResponse('That is the last owner'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const tenant = c.get('tenant');
    const member = await Membership.changeRole(
      db,
      tenant.organizationId,
      tenant.role!,
      c.req.valid('param').accountId,
      c.req.valid('json').role
    );
    return c.json(toMemberResponse(member), 200);
  }
);

organizations.openapi(
  defineRoute({
    method: 'delete',
    path: '/organizations/{id}/members/{accountId}',
    scope: 'organization',
    permission: 'member:remove',
    summary: 'Remove a member',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('member:remove')] as const,
    request: { params: z.object({ id: z.string().uuid(), accountId: z.string().uuid() }) },
    responses: {
      204: { description: 'Removed' },
      403: problemResponse('Insufficient role, or cannot act on an owner'),
      404: problemResponse('No such member'),
      409: problemResponse('That is the last owner'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const tenant = c.get('tenant');
    await Membership.removeMember(
      db,
      tenant.organizationId,
      tenant.role!,
      c.req.valid('param').accountId
    );
    return c.body(null, 204);
  }
);

organizations.openapi(
  defineRoute({
    method: 'get',
    path: '/organizations/{id}/invitations',
    scope: 'organization',
    permission: 'member:invite',
    summary: 'Pending invitations',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('member:invite')] as const,
    request: { params: IdParam },
    responses: {
      200: { description: 'Pending', content: { 'application/json': { schema: z.array(InvitationSchema) } } },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or not yours'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const rows = await Membership.listPendingInvitations(db, c.get('tenant').organizationId);
    return c.json(
      rows.map((r) => ({ id: r.id, email: r.email, role: r.role, expiresAt: r.expiresAt.toISOString() })),
      200
    );
  }
);

organizations.openapi(
  defineRoute({
    method: 'post',
    path: '/organizations/{id}/invitations',
    scope: 'organization',
    permission: 'member:invite',
    summary: 'Invite someone by email',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('member:invite')] as const,
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({ email: z.string().email(), role: RoleSchema }),
          },
        },
      },
    },
    responses: {
      201: {
        description:
          'Created. `token` is returned ONCE — it is emailed to the invitee and never stored in plain text.',
        content: { 'application/json': { schema: InvitationSchema.extend({ token: z.string() }) } },
      },
      403: problemResponse('Insufficient role, or inviting above your own'),
      404: problemResponse('Not found, or not yours'),
      409: problemResponse('Already a member'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const tenant = c.get('tenant');
    const invite = await Membership.inviteMember(
      db,
      tenant.organizationId,
      tenant.role!,
      tenant.accountId!,
      c.req.valid('json')
    );
    return c.json({ ...invite, expiresAt: invite.expiresAt.toISOString() }, 201);
  }
);

organizations.openapi(
  defineRoute({
    method: 'delete',
    path: '/organizations/{id}/invitations/{invitationId}',
    scope: 'organization',
    permission: 'member:invite',
    summary: 'Revoke a pending invitation',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('member:invite')] as const,
    request: {
      params: z.object({ id: z.string().uuid(), invitationId: z.string().uuid() }),
    },
    responses: {
      204: { description: 'Revoked' },
      403: problemResponse('Insufficient role'),
      404: problemResponse('No such pending invitation'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    await Membership.revokeInvitation(
      db,
      c.get('tenant').organizationId,
      c.req.valid('param').invitationId
    );
    return c.body(null, 204);
  }
);
