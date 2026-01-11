import { Hono } from 'hono';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { loyalty, CreateLoyaltySchema, UpdateLoyaltySchema } from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';
import { calculateTier } from '@credopass/lib/util';

const loyaltyRouter = new Hono();

// Mount standard CRUD
loyaltyRouter.route('/', createCrudRoute({
  table: loyalty,
  createSchema: CreateLoyaltySchema,
  updateSchema: UpdateLoyaltySchema,
  sortField: loyalty.issuedAt,
  allowedFilters: ['patronId', 'tier']
}));

// Custom routes
// GET /patron/:patronId/points - Get patron's total points
loyaltyRouter.get('/patron/:patronId/points', async (c) => {
  try {
    const db = await getDatabase();
    const patronId = c.req.param('patronId');
    const now = new Date();

    // Get active (non-expired) records
    const records = await db
      .select()
      .from(loyalty)
      .where(
        and(
          eq(loyalty.patronId, patronId),
          gte(loyalty.expiresAt, now)
        )
      );

    const totalPoints = records.reduce((sum, record) => sum + (record.points || 0), 0);

    return c.json({ patronId, totalPoints });
  } catch (error) {
    console.error('Error fetching patron points:', error);
    return c.json({ error: 'Failed to fetch patron points' }, 500);
  }
});

// GET /patron/:patronId/tier - Get/calculate patron's tier
loyaltyRouter.get('/patron/:patronId/tier', async (c) => {
  try {
    const db = await getDatabase();
    const patronId = c.req.param('patronId');
    const now = new Date();

    const records = await db
      .select()
      .from(loyalty)
      .where(
        and(
          eq(loyalty.patronId, patronId),
          gte(loyalty.expiresAt, now)
        )
      );

    const totalPoints = records.reduce((sum, record) => sum + (record.points || 0), 0);
    const tier = calculateTier(totalPoints);

    return c.json({ patronId, totalPoints, tier });
  } catch (error) {
    console.error('Error calculating tier:', error);
    return c.json({ error: 'Failed to calculate tier' }, 500);
  }
});

export default loyaltyRouter;
