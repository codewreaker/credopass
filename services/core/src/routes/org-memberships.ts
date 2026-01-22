import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { 
  orgMemberships,
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

// PUT /:id/role - Change member role (admin only)
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
