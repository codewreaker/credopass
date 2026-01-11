// ============================================================================
// FILE: apps/api/src/routes/events.ts
// Events API routes using Hono with Drizzle
// ============================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { CreateEventSchema, UpdateEventSchema, EventSchema, events } from '@credopass/lib/schemas';

const eventsRouter = new Hono();

// GET /api/events - Get all events
eventsRouter.get('/', async (c) => {
  try {
    const db = await getDatabase();
    const status = c.req.query('status');
    const hostId = c.req.query('hostId');

    if (status) {
      const result = await db
        .select()
        .from(events)
        .where(eq(events.status, status as any))
        .orderBy(desc(events.startTime));
      return c.json(result);
    } else if (hostId) {
      const result = await db
        .select()
        .from(events)
        .where(eq(events.hostId, hostId))
        .orderBy(desc(events.startTime));
      return c.json(result);
    } else {
      const result = await db
        .select()
        .from(events)
        .orderBy(desc(events.startTime));
      return c.json(result);
    }
  } catch (error) {
    console.error('Error fetching events:', error);
    return c.json({ error: 'Failed to fetch events' }, 500);
  }
});

// GET /api/events/:id - Get event by ID
eventsRouter.get('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');
    const result = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!result[0]) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    return c.json({ error: 'Failed to fetch event' }, 500);
  }
});

// POST /api/events - Create new event
eventsRouter.post('/', async (c) => {
  try {
    const db = await getDatabase();
    const body = await c.req.json();

    const processedBody = {
      ...body,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    };

    const validated = CreateEventSchema.parse(processedBody);

    const now = new Date();
    const result = await db
      .insert(events)
      .values({
        ...validated,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(result[0], 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error creating event:', error);
    return c.json({ error: 'Failed to create event' }, 500);
  }
});

// PUT /api/events/:id - Update event
eventsRouter.put('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');
    const body = await c.req.json();

    const processedBody = body.startTime || body.endTime ? {
      ...body,
      ...(body.startTime && { startTime: new Date(body.startTime) }),
      ...(body.endTime && { endTime: new Date(body.endTime) }),
    } : body;

    const validated = UpdateEventSchema.parse(processedBody);

    const result = await db
      .update(events)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();

    if (!result[0]) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error updating event:', error);
    return c.json({ error: 'Failed to update event' }, 500);
  }
});

// PATCH /api/events/:id/status - Update event status
eventsRouter.patch('/:id/status', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');
    const body = await c.req.json();
    const StatusSchema = EventSchema.pick({ status: true });

    const { status } = StatusSchema.parse(body);

    const result = await db
      .update(events)
      .set({ status, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    if (!result[0]) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error updating event status:', error);
    return c.json({ error: 'Failed to update event status' }, 500);
  }
});

// DELETE /api/events/:id - Delete event
eventsRouter.delete('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');

    const existing = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!existing[0]) {
      return c.json({ error: 'Event not found' }, 404);
    }

    await db.delete(events).where(eq(events.id, id));

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting event:', error);
    return c.json({ error: 'Failed to delete event' }, 500);
  }
});

export default eventsRouter;
