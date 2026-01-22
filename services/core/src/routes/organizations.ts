import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { 
  organizations, 
  orgMemberships,
  CreateOrganizationSchema, 
  UpdateOrganizationSchema 
} from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';

const organizationsRouter = new Hono();

// Mount standard CRUD
organizationsRouter.route('/', createCrudRoute({
  table: organizations,
  createSchema: CreateOrganizationSchema,
  updateSchema: UpdateOrganizationSchema,
  sortField: organizations.createdAt,
  allowedFilters: ['plan', 'slug'],
  uniqueFields: ['slug']
}));

// Custom routes

// GET /:id/members - Get all members of an organization
organizationsRouter.get('/:id/members', async (c) => {
  try {
    const db = await getDatabase();
    const organizationId = c.req.param('id');

    const members = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.organizationId, organizationId));

    return c.json(members);
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return c.json({ error: 'Failed to fetch organization members' }, 500);
  }
});

// GET /slug/:slug - Get organization by slug (for URL-based lookups)
organizationsRouter.get('/slug/:slug', async (c) => {
  try {
    const db = await getDatabase();
    const slug = c.req.param('slug');

    const result = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!result[0]) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    console.error('Error fetching organization by slug:', error);
    return c.json({ error: 'Failed to fetch organization' }, 500);
  }
});

export default organizationsRouter;
