// ============================================================================
// FILE: server/api/loyalty.ts
// Loyalty API - Direct Drizzle queries
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, gte } from 'drizzle-orm';
import { getDatabase, loyalty, LoyaltySchema } from '../server/db';

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

// Helper: Calculate tier from points
function calculateTier(totalPoints: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
    if (totalPoints >= 10000) return 'platinum';
    if (totalPoints >= 5000) return 'gold';
    if (totalPoints >= 2000) return 'silver';
    return 'bronze';
}

// GET /api/loyalty - Get all loyalty records
loyaltyRouter.get("/", async (c) => {
    try {
        const db = await getDatabase();
        const patronId = c.req.query("patronId");
        const tier = c.req.query("tier");
        
        if (patronId) {
            const result = await db
                .select()
                .from(loyalty)
                .where(eq(loyalty.patronId, patronId))
                .orderBy(desc(loyalty.issuedAt));
            return c.json(result);
        } else if (tier) {
            const result = await db
                .select()
                .from(loyalty)
                .where(eq(loyalty.tier, tier as any))
                .orderBy(desc(loyalty.issuedAt));
            return c.json(result);
        } else {
            const result = await db
                .select()
                .from(loyalty)
                .orderBy(desc(loyalty.issuedAt));
            return c.json(result);
        }
    } catch (error) {
        console.error("Error fetching loyalty records:", error);
        return c.json({ error: "Failed to fetch loyalty records" }, 500);
    }
});

// GET /api/loyalty/:id - Get loyalty record by ID
loyaltyRouter.get("/:id", async (c) => {
    try {
        const db = await getDatabase();
        const id = c.req.param("id");
        const result = await db
            .select()
            .from(loyalty)
            .where(eq(loyalty.id, id))
            .limit(1);

        if (!result[0]) {
            return c.json({ error: "Loyalty record not found" }, 404);
        }

        return c.json(result[0]);
    } catch (error) {
        console.error("Error fetching loyalty record:", error);
        return c.json({ error: "Failed to fetch loyalty record" }, 500);
    }
});

// GET /api/loyalty/patron/:patronId/points - Get patron's total points
loyaltyRouter.get("/patron/:patronId/points", async (c) => {
    try {
        const db = await getDatabase();
        const patronId = c.req.param("patronId");
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
        console.error("Error fetching patron points:", error);
        return c.json({ error: "Failed to fetch patron points" }, 500);
    }
});

// GET /api/loyalty/patron/:patronId/tier - Get/calculate patron's tier
loyaltyRouter.get("/patron/:patronId/tier", async (c) => {
    try {
        const db = await getDatabase();
        const patronId = c.req.param("patronId");
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
        const tier = calculateTier(totalPoints);

        return c.json({ patronId, tier, totalPoints });
    } catch (error) {
        console.error("Error calculating patron tier:", error);
        return c.json({ error: "Failed to calculate patron tier" }, 500);
    }
});

// POST /api/loyalty - Create loyalty record
loyaltyRouter.post("/", async (c) => {
    try {
        const db = await getDatabase();
        const body = await c.req.json();
        
        // Convert date strings to Date objects
        const processedBody: any = { ...body };
        if (body.issuedAt) processedBody.issuedAt = new Date(body.issuedAt);
        if (body.expiresAt) processedBody.expiresAt = new Date(body.expiresAt);
        
        const validated = CreateLoyaltySchema.parse(processedBody);
        
        const result = await db
            .insert(loyalty)
            .values(validated)
            .returning();
        
        return c.json(result[0], 201);
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
        const db = await getDatabase();
        const body = await c.req.json();
        const validated = AwardPointsSchema.parse(body);
        
        const result = await db
            .insert(loyalty)
            .values({
                id: crypto.randomUUID(),
                patronId: validated.patronId,
                description: validated.description,
                points: validated.points,
                tier: null,
                reward: null,
                issuedAt: new Date(),
                expiresAt: null, // Points don't expire by default
            })
            .returning();
        
        return c.json(result[0], 201);
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
        const db = await getDatabase();
        const body = await c.req.json();
        const validated = AwardRewardSchema.parse(body);
        
        const expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : null;
        
        const result = await db
            .insert(loyalty)
            .values({
                id: crypto.randomUUID(),
                patronId: validated.patronId,
                description: validated.description,
                reward: validated.reward,
                tier: null,
                points: null,
                issuedAt: new Date(),
                expiresAt,
            })
            .returning();
        
        return c.json(result[0], 201);
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
        const db = await getDatabase();
        const id = c.req.param("id");
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.issuedAt) processedBody.issuedAt = new Date(body.issuedAt);
        if (body.expiresAt) processedBody.expiresAt = new Date(body.expiresAt);
        
        const validated = UpdateLoyaltySchema.parse(processedBody);
        
        const result = await db
            .update(loyalty)
            .set(validated)
            .where(eq(loyalty.id, id))
            .returning();

        if (!result[0]) {
            return c.json({ error: "Loyalty record not found" }, 404);
        }

        return c.json(result[0]);
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
        const db = await getDatabase();
        const id = c.req.param("id");
        
        const existing = await db
            .select()
            .from(loyalty)
            .where(eq(loyalty.id, id))
            .limit(1);
            
        if (!existing[0]) {
            return c.json({ error: "Loyalty record not found" }, 404);
        }

        await db.delete(loyalty).where(eq(loyalty.id, id));

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting loyalty record:", error);
        return c.json({ error: "Failed to delete loyalty record" }, 500);
    }
});

export default loyaltyRouter;
