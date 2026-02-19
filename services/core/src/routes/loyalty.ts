import { Hono } from 'hono';
import { eq, and, gte, or, isNull } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { loyalty, CreateLoyaltySchema, UpdateLoyaltySchema } from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';
import { calculateTier } from '@credopass/lib/utils';

const loyaltyRouter = new Hono();

// Mount standard CRUD
loyaltyRouter.route('/', createCrudRoute({
  table: loyalty,
  createSchema: CreateLoyaltySchema,
  updateSchema: UpdateLoyaltySchema,
  sortField: loyalty.issuedAt,
  allowedFilters: ['patronId', 'tier', 'organizationId']
}));

// Custom routes
// GET /patron/:patronId/points - Get patron's total points
// Query param: ?organizationId=xxx for tenant filtering
loyaltyRouter.get('/patron/:patronId/points', async (c) => {
  try {
    const db = await getDatabase();
    const patronId = c.req.param('patronId');
    const organizationId = c.req.query('organizationId');
    const now = new Date();

    // Build filters - include records where expiresAt is null OR expiresAt >= now
    const filters = [
      eq(loyalty.patronId, patronId),
      or(
        isNull(loyalty.expiresAt),
        gte(loyalty.expiresAt, now)
      )
    ];

    // Add org filter if provided (for multi-tenancy)
    if (organizationId) {
      filters.push(eq(loyalty.organizationId, organizationId));
    }

    const records = await db
      .select()
      .from(loyalty)
      .where(and(...filters));

    const totalPoints = records.reduce((sum, record) => sum + (record.points || 0), 0);

    return c.json({ patronId, organizationId, totalPoints });
  } catch (error) {
    console.error('Error fetching patron points:', error);
    return c.json({ error: 'Failed to fetch patron points' }, 500);
  }
});

// GET /patron/:patronId/tier - Get/calculate patron's tier
// Query param: ?organizationId=xxx for tenant filtering
loyaltyRouter.get('/patron/:patronId/tier', async (c) => {
  try {
    const db = await getDatabase();
    const patronId = c.req.param('patronId');
    const organizationId = c.req.query('organizationId');
    const now = new Date();

    // Build filters - include records where expiresAt is null OR expiresAt >= now
    const filters = [
      eq(loyalty.patronId, patronId),
      or(
        isNull(loyalty.expiresAt),
        gte(loyalty.expiresAt, now)
      )
    ];

    // Add org filter if provided (for multi-tenancy)
    if (organizationId) {
      filters.push(eq(loyalty.organizationId, organizationId));
    }

    const records = await db
      .select()
      .from(loyalty)
      .where(and(...filters));

    const totalPoints = records.reduce((sum, record) => sum + (record.points || 0), 0);
    const tier = calculateTier(totalPoints);

    return c.json({ patronId, organizationId, totalPoints, tier });
  } catch (error) {
    console.error('Error calculating tier:', error);
    return c.json({ error: 'Failed to calculate tier' }, 500);
  }
});

export default loyaltyRouter;
