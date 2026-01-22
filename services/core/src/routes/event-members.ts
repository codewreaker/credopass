import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { 
  eventMembers, 
  CreateEventMemberSchema, 
  UpdateEventMemberSchema 
} from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';

const eventMembersRouter = new Hono();

// Mount standard CRUD
eventMembersRouter.route('/', createCrudRoute({
  table: eventMembers,
  createSchema: CreateEventMemberSchema,
  updateSchema: UpdateEventMemberSchema,
  sortField: eventMembers.createdAt,
  allowedFilters: ['eventId', 'userId', 'role']
}));

// Custom routes

// GET /event/:eventId - Get all members for an event
eventMembersRouter.get('/event/:eventId', async (c) => {
  try {
    const db = await getDatabase();
    const eventId = c.req.param('eventId');

    const members = await db
      .select()
      .from(eventMembers)
      .where(eq(eventMembers.eventId, eventId));

    return c.json(members);
  } catch (error) {
    console.error('Error fetching event members:', error);
    return c.json({ error: 'Failed to fetch event members' }, 500);
  }
});

// GET /user/:userId - Get all events a user is a member of
eventMembersRouter.get('/user/:userId', async (c) => {
  try {
    const db = await getDatabase();
    const userId = c.req.param('userId');

    const memberships = await db
      .select()
      .from(eventMembers)
      .where(eq(eventMembers.userId, userId));

    return c.json(memberships);
  } catch (error) {
    console.error('Error fetching user event memberships:', error);
    return c.json({ error: 'Failed to fetch user event memberships' }, 500);
  }
});

// PUT /:id/role - Update event member role
eventMembersRouter.put('/:id/role', async (c) => {
  try {
    const db = await getDatabase();
    const memberId = c.req.param('id');
    const { role } = await c.req.json();

    // Validate role
    const validRoles = ['organizer', 'co-host', 'staff', 'volunteer'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    const result = await db
      .update(eventMembers)
      .set({ 
        role,
        updatedAt: new Date()
      })
      .where(eq(eventMembers.id, memberId))
      .returning();

    if (!result[0]) {
      return c.json({ error: 'Event member not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    console.error('Error updating event member role:', error);
    return c.json({ error: 'Failed to update role' }, 500);
  }
});

export default eventMembersRouter;
