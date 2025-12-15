// ============================================================================
// FILE: server/api/events.ts
// Events API - Using BaseAPI pattern
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import { BaseAPI } from './BaseAPI.js';
import { events, type Event, type EventInsert, EventSchema, CreateEventSchema } from '../db/schema.js';

// ============================================================================
// EventAPI - Extends BaseAPI with custom methods
// ============================================================================

class EventAPI extends BaseAPI<Event, EventInsert, typeof events> {
    protected readonly table = events;
    protected readonly tableName = 'events';

    async findByStatus(status: Event['status']): Promise<Event[]> {
        try {
            return await this.db
                .select()
                .from(events)
                .where(eq(events.status, status))
                .orderBy(desc(events.startTime));
        } catch (error) {
            throw new Error(`Failed to find events by status: ${error}`);
        }
    }

    async findByHostId(hostId: string): Promise<Event[]> {
        try {
            return await this.db
                .select()
                .from(events)
                .where(eq(events.hostId, hostId))
                .orderBy(desc(events.startTime));
        } catch (error) {
            throw new Error(`Failed to find events by host: ${error}`);
        }
    }

    async findByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
        try {
            return await this.db
                .select()
                .from(events)
                .where(
                    and(
                        gte(events.startTime, startDate),
                        lte(events.endTime, endDate)
                    )
                )
                .orderBy(desc(events.startTime));
        } catch (error) {
            throw new Error(`Failed to find events by date range: ${error}`);
        }
    }

    async updateStatus(id: string, status: Event['status']): Promise<Event | undefined> {
        return await this.update(id, { status });
    }
}

// Initialize API
const eventAPI = new EventAPI();

// ============================================================================
// HTTP Routes
// ============================================================================

const eventsRouter = new Hono();

// Validation schemas
const UpdateEventSchema = EventSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

// GET /api/events - Get all events
eventsRouter.get("/", async (c) => {
    try {
        const status = c.req.query("status");
        const hostId = c.req.query("hostId");

        let allEvents;
        if (status) {
            allEvents = await eventAPI.findByStatus(status as any);
        } else if (hostId) {
            allEvents = await eventAPI.findByHostId(hostId);
        } else {
            allEvents = await eventAPI.findAll();
        }

        return c.json(allEvents);
    } catch (error) {
        console.error("Error fetching events:", error);
        return c.json({ error: "Failed to fetch events" }, 500);
    }
});

// GET /api/events/:id - Get event by ID
eventsRouter.get("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const event = await eventAPI.findById(id);

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
eventsRouter.post("/", async (c) => {
    try {
        const body = await c.req.json();

        const processedBody = {
            ...body,
            startTime: new Date(body.startTime),
            endTime: new Date(body.endTime),
        };

        const validated = CreateEventSchema.parse(processedBody);

        const now = new Date();
        const event = await eventAPI.create({
            ...validated,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
        });

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
eventsRouter.put("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();

        const processedBody = body.startTime || body.endTime ? {
            ...body,
            ...(body.startTime && { startTime: new Date(body.startTime) }),
            ...(body.endTime && { endTime: new Date(body.endTime) }),
        } : body;

        const validated = UpdateEventSchema.parse(processedBody);

        const event = await eventAPI.update(id, {
            ...validated,
            updatedAt: new Date(),
        });

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
eventsRouter.patch("/:id/status", async (c) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const StatusSchema = EventSchema.pick({ status: true });

        const { status } = StatusSchema.parse(body);
        const event = await eventAPI.updateStatus(id, status);

        if (!event) {
            return c.json({ error: "Event not found" }, 404);
        }

        return c.json(event);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error updating event status:", error);
        return c.json({ error: "Failed to update event status" }, 500);
    }
});

// DELETE /api/events/:id - Delete event
eventsRouter.delete("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const deleted = await eventAPI.delete(id);

        if (!deleted) {
            return c.json({ error: "Event not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting event:", error);
        return c.json({ error: "Failed to delete event" }, 500);
    }
});

export default eventsRouter;
