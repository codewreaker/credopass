// ============================================================================
// FILE: server/routes/events.ts
// Hono routes for events with Drizzle ORM
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { getDatabase, EventOperations } from "../db";
import { EventSchema, CreateEventSchema } from '../../src/entities/schemas';

const events = new Hono();

// Validation schemas
const UpdateEventSchema = EventSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

// GET /api/events - Get all events
events.get("/", async (c) => {
    try {
        const db = getDatabase();
        const eventOps = new EventOperations(db);
        
        const status = c.req.query("status");
        const hostId = c.req.query("hostId");
        
        let allEvents;
        if (status) {
            allEvents = await eventOps.findByStatus(status as any);
        } else if (hostId) {
            allEvents = await eventOps.findByHostId(hostId);
        } else {
            allEvents = await eventOps.findAll();
        }
        
        return c.json(allEvents);
    } catch (error) {
        console.error("Error fetching events:", error);
        return c.json({ error: "Failed to fetch events" }, 500);
    }
});

// GET /api/events/:id - Get event by ID
events.get("/:id", async (c) => {
    try {
        const db = getDatabase();
        const eventOps = new EventOperations(db);
        const id = c.req.param("id");
        const event = await eventOps.findById(id);

        if (!event) {
            return c.json({ error: "Event not found" }, 404);
        }

        return c.json(event);
    } catch (error) {
        console.error("Error fetching event:", error);
        return c.json({ error: "Failed to fetch event" }, 500);
    }
});

// POST /api/events - Create new event
events.post("/", async (c) => {
    try {
        const db = getDatabase();
        const eventOps = new EventOperations(db);
        const body = await c.req.json();
        
        // Convert date strings to Date objects
        const processedBody = {
            ...body,
            startTime: new Date(body.startTime),
            endTime: new Date(body.endTime),
        };
        
        const validated = CreateEventSchema.parse(processedBody);

        const event = await eventOps.create(validated);
        return c.json(event, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error creating event:", error);
        return c.json({ error: "Failed to create event" }, 500);
    }
});

// PUT /api/events/:id - Update event
events.put("/:id", async (c) => {
    try {
        const db = getDatabase();
        const eventOps = new EventOperations(db);
        const id = c.req.param("id");
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.startTime) processedBody.startTime = new Date(body.startTime);
        if (body.endTime) processedBody.endTime = new Date(body.endTime);
        
        const validated = UpdateEventSchema.parse(processedBody);

        const event = await eventOps.update(id, validated);

        if (!event) {
            return c.json({ error: "Event not found" }, 404);
        }

        return c.json(event);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error updating event:", error);
        return c.json({ error: "Failed to update event" }, 500);
    }
});

// PATCH /api/events/:id/status - Update event status
events.patch("/:id/status", async (c) => {
    try {
        const db = getDatabase();
        const eventOps = new EventOperations(db);
        const id = c.req.param("id");
        const body = await c.req.json();
        
        if (!body.status) {
            return c.json({ error: "Status is required" }, 400);
        }

        const event = await eventOps.updateStatus(id, body.status);

        if (!event) {
            return c.json({ error: "Event not found" }, 404);
        }

        return c.json(event);
    } catch (error) {
        console.error("Error updating event status:", error);
        return c.json({ error: "Failed to update event status" }, 500);
    }
});

// DELETE /api/events/:id - Delete event
events.delete("/:id", async (c) => {
    try {
        const db = getDatabase();
        const eventOps = new EventOperations(db);
        const id = c.req.param("id");
        const deleted = await eventOps.delete(id);

        if (!deleted) {
            return c.json({ error: "Event not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting event:", error);
        return c.json({ error: "Failed to delete event" }, 500);
    }
});

export default events;
