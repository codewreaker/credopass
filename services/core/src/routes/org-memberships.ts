import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import {
  orgMemberships,
  users,
  CreateOrgMembershipSchema,
  UpdateOrgMembershipSchema
} from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';

const orgMembershipsRouter = new Hono();

// Mount standard CRUD
orgMembershipsRouter.route('/', createCrudRoute({
  table: orgMemberships,
  createSchema: CreateOrgMembershipSchema,
  updateSchema: UpdateOrgMembershipSchema,
  sortField: orgMemberships.createdAt,
  allowedFilters: ['userId', 'organizationId', 'role']
}));

// Custom routes

// GET /user/:userId/organizations - Get all organizations a user belongs to
orgMembershipsRouter.get('/user/:userId/organizations', async (c) => {
  try {
    const db = await getDatabase();
    const userId = c.req.param('userId');

    const memberships = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.userId, userId));

    return c.json(memberships);
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    return c.json({ error: 'Failed to fetch user organizations' }, 500);
  }
});

// POST /:id/accept - Accept an invitation
orgMembershipsRouter.post('/:id/accept', async (c) => {
  try {
    const db = await getDatabase();
    const membershipId = c.req.param('id');

    const result = await db
      .update(orgMemberships)
      .set({ 
        acceptedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(orgMemberships.id, membershipId))
      .returning();

    if (!result[0]) {
      return c.json({ error: 'Membership not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return c.json({ error: 'Failed to accept invitation' }, 500);
  }
});

// PUT /:id/role - Change member role (owner/admin of the same org only).
// The caller is resolved from the verified JWT: email -> users row ->
// membership in the target org. Until the auth-user <-> users linkage
// gets a dedicated column, callers without a users row (e.g. anonymous
// guests) cannot change roles at all - which is the correct default.
orgMembershipsRouter.put('/:id/role', async (c) => {
  try {
    const db = await getDatabase();
    const membershipId = c.req.param('id');
    const { role } = await c.req.json();

    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    const target = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.id, membershipId))
      .limit(1);

    if (!target[0]) {
      return c.json({ error: 'Membership not found' }, 404);
    }

    // Resolve the caller's membership in the target organization
    const callerEmail = (c.get('jwtPayload' as never) as { email?: string } | undefined)?.email;
    if (!callerEmail) {
      return c.json({ error: 'Forbidden: role changes require a registered account' }, 403);
    }

    const caller = await db
      .select()
      .from(users)
      .where(eq(users.email, callerEmail))
      .limit(1);

    const callerMembership = caller[0]
      ? await db
          .select()
          .from(orgMemberships)
          .where(and(
            eq(orgMemberships.userId, caller[0].id),
            eq(orgMemberships.organizationId, target[0].organizationId)
          ))
          .limit(1)
      : [];

    if (!callerMembership[0] || !['owner', 'admin'].includes(callerMembership[0].role)) {
      return c.json({ error: 'Forbidden: only organization owners/admins can change roles' }, 403);
    }

    const result = await db
      .update(orgMemberships)
      .set({
        role,
        updatedAt: new Date()
      })
      .where(eq(orgMemberships.id, membershipId))
      .returning();

    if (!result[0]) {
      return c.json({ error: 'Membership not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    console.error('Error updating role:', error);
    return c.json({ error: 'Failed to update role' }, 500);
  }
});

export default orgMembershipsRouter;
