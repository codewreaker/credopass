// ============================================================================
// FILE: server/routes/loyalty.ts
// Hono routes for loyalty with Drizzle ORM
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { getDatabase, LoyaltyOperations } from "../db";
import { LoyaltySchema } from '../../src/entities/schemas';

const loyalty = new Hono();

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
loyalty.get("/", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        
        const patronId = c.req.query("patronId");
        const tier = c.req.query("tier");
        
        let records;
        if (patronId) {
            records = await loyaltyOps.findByPatronId(patronId);
        } else if (tier) {
            records = await loyaltyOps.findByTier(tier as any);
        } else {
            records = await loyaltyOps.findAll();
        }
        
        return c.json(records);
    } catch (error) {
        console.error("Error fetching loyalty records:", error);
        return c.json({ error: "Failed to fetch loyalty records" }, 500);
    }
});

// GET /api/loyalty/:id - Get loyalty record by ID
loyalty.get("/:id", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const id = c.req.param("id");
        const record = await loyaltyOps.findById(id);

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
loyalty.get("/patron/:patronId/points", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const patronId = c.req.param("patronId");
        const totalPoints = await loyaltyOps.getTotalPoints(patronId);

        return c.json({ patronId, totalPoints });
    } catch (error) {
        console.error("Error fetching patron points:", error);
        return c.json({ error: "Failed to fetch patron points" }, 500);
    }
});

// GET /api/loyalty/patron/:patronId/tier - Get/calculate patron's tier
loyalty.get("/patron/:patronId/tier", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const patronId = c.req.param("patronId");
        const tier = await loyaltyOps.updatePatronTier(patronId);

        return c.json({ patronId, tier });
    } catch (error) {
        console.error("Error calculating patron tier:", error);
        return c.json({ error: "Failed to calculate patron tier" }, 500);
    }
});

// POST /api/loyalty - Create loyalty record
loyalty.post("/", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const body = await c.req.json();
        
        // Convert date strings to Date objects
        const processedBody: any = { ...body };
        if (body.issuedAt) processedBody.issuedAt = new Date(body.issuedAt);
        if (body.expiresAt) processedBody.expiresAt = new Date(body.expiresAt);
        
        const validated = CreateLoyaltySchema.parse(processedBody);
        const record = await loyaltyOps.create(validated);
        
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
loyalty.post("/award-points", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const body = await c.req.json();
        const validated = AwardPointsSchema.parse(body);
        
        const id = crypto.randomUUID();
        const record = await loyaltyOps.awardPoints(
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
loyalty.post("/award-reward", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const body = await c.req.json();
        const validated = AwardRewardSchema.parse(body);
        
        const id = crypto.randomUUID();
        const expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : undefined;
        
        const record = await loyaltyOps.awardReward(
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
loyalty.put("/:id", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const id = c.req.param("id");
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.issuedAt) processedBody.issuedAt = new Date(body.issuedAt);
        if (body.expiresAt) processedBody.expiresAt = new Date(body.expiresAt);
        
        const validated = UpdateLoyaltySchema.parse(processedBody);
        const record = await loyaltyOps.update(id, validated);

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
loyalty.delete("/:id", async (c) => {
    try {
        const db = getDatabase();
        const loyaltyOps = new LoyaltyOperations(db);
        const id = c.req.param("id");
        const deleted = await loyaltyOps.delete(id);

        if (!deleted) {
            return c.json({ error: "Loyalty record not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting loyalty record:", error);
        return c.json({ error: "Failed to delete loyalty record" }, 500);
    }
});

export default loyalty;
