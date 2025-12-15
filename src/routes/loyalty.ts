// ============================================================================
// FILE: server/api/loyalty.ts
// Loyalty API - Using BaseAPI pattern
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, gte } from 'drizzle-orm';
import { BaseAPI } from './BaseAPI.js';
import { loyalty, type Loyalty, type LoyaltyInsert, LoyaltySchema } from '../db/schema.js';

// ============================================================================
// LoyaltyAPI - Extends BaseAPI with custom methods
// ============================================================================

class LoyaltyAPI extends BaseAPI<Loyalty, LoyaltyInsert, typeof loyalty> {
  protected readonly table = loyalty;
  protected readonly tableName = 'loyalty';

  /**
   * Find all loyalty records ordered by issued date
   */
  
  override async findAll(): Promise<Loyalty[]> {
    try {
      return await this.db
        .select()
        .from(loyalty)
        .orderBy(desc(loyalty.issuedAt));
    } catch (error) {
      throw new Error(`Failed to find all loyalty records: ${error}`);
    }
  }

  /**
   * Find loyalty records by patron ID
   */
  async findByPatronId(patronId: string): Promise<Loyalty[]> {
    try {
      return await this.db
        .select()
        .from(loyalty)
        .where(eq(loyalty.patronId, patronId))
        .orderBy(desc(loyalty.issuedAt));
    } catch (error) {
      throw new Error(`Failed to find loyalty records by patron: ${error}`);
    }
  }

  /**
   * Find loyalty records by tier
   */
  async findByTier(tier: Loyalty['tier']): Promise<Loyalty[]> {
    try {
      if (tier === null) {
        return await this.db
          .select()
          .from(loyalty)
          .orderBy(desc(loyalty.issuedAt));
      }
      return await this.db
        .select()
        .from(loyalty)
        .where(eq(loyalty.tier, tier))
        .orderBy(desc(loyalty.issuedAt));
    } catch (error) {
      throw new Error(`Failed to find loyalty records by tier: ${error}`);
    }
  }

  /**
   * Find active loyalty records for a patron (not expired)
   */
  async findActiveByPatronId(patronId: string): Promise<Loyalty[]> {
    try {
      const now = new Date();
      return await this.db
        .select()
        .from(loyalty)
        .where(
          and(
            eq(loyalty.patronId, patronId),
            gte(loyalty.expiresAt, now)
          )
        )
        .orderBy(desc(loyalty.issuedAt));
    } catch (error) {
      throw new Error(`Failed to find active loyalty records: ${error}`);
    }
  }

  /**
   * Get total points for a patron (only active/non-expired points)
   */
  async getTotalPoints(patronId: string): Promise<number> {
    try {
      const records = await this.findActiveByPatronId(patronId);
      return records.reduce((sum, record) => sum + (record.points || 0), 0);
    } catch (error) {
      throw new Error(`Failed to get total points: ${error}`);
    }
  }

  /**
   * Award points to a patron
   */
  async awardPoints(patronId: string, points: number, description: string, id: string): Promise<Loyalty> {
    try {
      return await this.create({
        id,
        patronId,
        description,
        points,
        tier: null,
        reward: null,
        issuedAt: new Date(),
        expiresAt: null, // Points don't expire by default
      });
    } catch (error) {
      throw new Error(`Failed to award points: ${error}`);
    }
  }

  /**
   * Award a reward to a patron
   */
  async awardReward(
    patronId: string,
    reward: string,
    description: string,
    id: string,
    expiresAt?: Date
  ): Promise<Loyalty> {
    try {
      return await this.create({
        id,
        patronId,
        description,
        reward,
        tier: null,
        points: null,
        issuedAt: new Date(),
        expiresAt: expiresAt || null,
      });
    } catch (error) {
      throw new Error(`Failed to award reward: ${error}`);
    }
  }

  /**
   * Calculate and return patron's tier based on total points
   */
  async calculatePatronTier(patronId: string): Promise<Loyalty['tier']> {
    try {
      const totalPoints = await this.getTotalPoints(patronId);
      
      let tier: Loyalty['tier'] = 'bronze';
      if (totalPoints >= 10000) tier = 'platinum';
      else if (totalPoints >= 5000) tier = 'gold';
      else if (totalPoints >= 2000) tier = 'silver';
      
      return tier;
    } catch (error) {
      throw new Error(`Failed to calculate patron tier: ${error}`);
    }
  }
}

// Initialize API
const loyaltyAPI = new LoyaltyAPI();

// ============================================================================
// HTTP Routes
// ============================================================================

const loyaltyRouter = new Hono();

// Validation schemas
const CreateLoyaltySchema = LoyaltySchema.omit({});
const UpdateLoyaltySchema = LoyaltySchema.partial().omit({ id: true });

const AwardPointsSchema = z.object({
    patronId: z.string().uuid(),
    points: z.number().int().positive(),
    description: z.string().min(1),
});

const AwardRewardSchema = z.object({
    patronId: z.string().uuid(),
    reward: z.string().min(1),
    description: z.string().min(1),
    expiresAt: z.string().optional(),
});

// GET /api/loyalty - Get all loyalty records
loyaltyRouter.get("/", async (c) => {
    try {
        const patronId = c.req.query("patronId");
        const tier = c.req.query("tier");
        
        let records;
        if (patronId) {
            records = await loyaltyAPI.findByPatronId(patronId);
        } else if (tier) {
            records = await loyaltyAPI.findByTier(tier as any);
        } else {
            records = await loyaltyAPI.findAll();
        }
        
        return c.json(records);
    } catch (error) {
        console.error("Error fetching loyalty records:", error);
        return c.json({ error: "Failed to fetch loyalty records" }, 500);
    }
});

// GET /api/loyalty/:id - Get loyalty record by ID
loyaltyRouter.get("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const record = await loyaltyAPI.findById(id);

        if (!record) {
            return c.json({ error: "Loyalty record not found" }, 404);
        }

        return c.json(record);
    } catch (error) {
        console.error("Error fetching loyalty record:", error);
        return c.json({ error: "Failed to fetch loyalty record" }, 500);
    }
});

// GET /api/loyalty/patron/:patronId/points - Get patron's total points
loyaltyRouter.get("/patron/:patronId/points", async (c) => {
    try {
        const patronId = c.req.param("patronId");
        const totalPoints = await loyaltyAPI.getTotalPoints(patronId);

        return c.json({ patronId, totalPoints });
    } catch (error) {
        console.error("Error fetching patron points:", error);
        return c.json({ error: "Failed to fetch patron points" }, 500);
    }
});

// GET /api/loyalty/patron/:patronId/tier - Get/calculate patron's tier
loyaltyRouter.get("/patron/:patronId/tier", async (c) => {
    try {
        const patronId = c.req.param("patronId");
        const tier = await loyaltyAPI.calculatePatronTier(patronId);

        return c.json({ patronId, tier });
    } catch (error) {
        console.error("Error calculating patron tier:", error);
        return c.json({ error: "Failed to calculate patron tier" }, 500);
    }
});

// POST /api/loyalty - Create loyalty record
loyaltyRouter.post("/", async (c) => {
    try {
        const body = await c.req.json();
        
        // Convert date strings to Date objects
        const processedBody: any = { ...body };
        if (body.issuedAt) processedBody.issuedAt = new Date(body.issuedAt);
        if (body.expiresAt) processedBody.expiresAt = new Date(body.expiresAt);
        
        const validated = CreateLoyaltySchema.parse(processedBody);
        const record = await loyaltyAPI.create(validated);
        
        return c.json(record, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error creating loyalty record:", error);
        return c.json({ error: "Failed to create loyalty record" }, 500);
    }
});

// POST /api/loyalty/award-points - Award points to patron
loyaltyRouter.post("/award-points", async (c) => {
    try {
        const body = await c.req.json();
        const validated = AwardPointsSchema.parse(body);
        
        const id = crypto.randomUUID();
        const record = await loyaltyAPI.awardPoints(
            validated.patronId,
            validated.points,
            validated.description,
            id
        );
        
        return c.json(record, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error awarding points:", error);
        return c.json({ error: "Failed to award points" }, 500);
    }
});

// POST /api/loyalty/award-reward - Award reward to patron
loyaltyRouter.post("/award-reward", async (c) => {
    try {
        const body = await c.req.json();
        const validated = AwardRewardSchema.parse(body);
        
        const id = crypto.randomUUID();
        const expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : undefined;
        
        const record = await loyaltyAPI.awardReward(
            validated.patronId,
            validated.reward,
            validated.description,
            id,
            expiresAt
        );
        
        return c.json(record, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error awarding reward:", error);
        return c.json({ error: "Failed to award reward" }, 500);
    }
});

// PUT /api/loyalty/:id - Update loyalty record
loyaltyRouter.put("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.issuedAt) processedBody.issuedAt = new Date(body.issuedAt);
        if (body.expiresAt) processedBody.expiresAt = new Date(body.expiresAt);
        
        const validated = UpdateLoyaltySchema.parse(processedBody);
        const record = await loyaltyAPI.update(id, validated);

        if (!record) {
            return c.json({ error: "Loyalty record not found" }, 404);
        }

        return c.json(record);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error updating loyalty record:", error);
        return c.json({ error: "Failed to update loyalty record" }, 500);
    }
});

// DELETE /api/loyalty/:id - Delete loyalty record
loyaltyRouter.delete("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const deleted = await loyaltyAPI.delete(id);

        if (!deleted) {
            return c.json({ error: "Loyalty record not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting loyalty record:", error);
        return c.json({ error: "Failed to delete loyalty record" }, 500);
    }
});

export default loyaltyRouter;
