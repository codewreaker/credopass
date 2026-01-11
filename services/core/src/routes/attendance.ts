// ============================================================================
// FILE: apps/api/src/routes/attendance.ts
// Attendance API routes using Hono with Drizzle
// ============================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { attendance, CreateAttendanceSchema, UpdateAttendanceSchema, CheckInSchema } from '@credopass/lib/schemas';

const attendanceRouter = new Hono();

// GET /api/attendance - Get all attendance records
attendanceRouter.get('/', async (c) => {
  try {
    const db = await getDatabase();
    const eventId = c.req.query('eventId');
    const patronId = c.req.query('patronId');

    if (eventId) {
      const result = await db
        .select()
        .from(attendance)
        .where(eq(attendance.eventId, eventId))
        .orderBy(desc(attendance.checkInTime));
      return c.json(result);
    } else if (patronId) {
      const result = await db
        .select()
        .from(attendance)
        .where(eq(attendance.patronId, patronId))
        .orderBy(desc(attendance.checkInTime));
      return c.json(result);
    } else {
      const result = await db
        .select()
        .from(attendance)
        .orderBy(desc(attendance.checkInTime));
      return c.json(result);
    }
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return c.json({ error: 'Failed to fetch attendance records' }, 500);
  }
});

// GET /api/attendance/:id - Get attendance by ID
attendanceRouter.get('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');
    const result = await db
      .select()
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);

    if (!result[0]) {
      return c.json({ error: 'Attendance record not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return c.json({ error: 'Failed to fetch attendance record' }, 500);
  }
});

// GET /api/attendance/event/:eventId/stats - Get event attendance stats
attendanceRouter.get('/event/:eventId/stats', async (c) => {
  try {
    const db = await getDatabase();
    const eventId = c.req.param('eventId');

    const records = await db
      .select()
      .from(attendance)
      .where(eq(attendance.eventId, eventId));

    const stats = {
      total: records.length,
      attended: records.filter(r => r.attended).length,
      checkedIn: records.filter(r => r.checkInTime !== null).length,
      checkedOut: records.filter(r => r.checkOutTime !== null).length,
    };

    return c.json(stats);
  } catch (error) {
    console.error('Error fetching event stats:', error);
    return c.json({ error: 'Failed to fetch event statistics' }, 500);
  }
});

// POST /api/attendance - Create attendance record
attendanceRouter.post('/', async (c) => {
  try {
    const db = await getDatabase();
    const body = await c.req.json();

    // Convert date strings to Date objects if present
    const processedBody: any = { ...body };
    if (body.checkInTime) processedBody.checkInTime = new Date(body.checkInTime);
    if (body.checkOutTime) processedBody.checkOutTime = new Date(body.checkOutTime);

    const validated = CreateAttendanceSchema.parse(processedBody);

    const result = await db
      .insert(attendance)
      .values(validated)
      .returning();

    return c.json(result[0], 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error creating attendance:', error);
    return c.json({ error: 'Failed to create attendance record' }, 500);
  }
});

// POST /api/attendance/check-in - Check-in to event
attendanceRouter.post('/check-in', async (c) => {
  try {
    const db = await getDatabase();
    const body = await c.req.json();
    const validated = CheckInSchema.parse(body);

    // Check if record exists
    const existing = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.eventId, validated.eventId),
          eq(attendance.patronId, validated.patronId)
        )
      )
      .limit(1);

    if (existing[0]) {
      // Update existing record
      const result = await db
        .update(attendance)
        .set({
          attended: true,
          checkInTime: new Date(),
        })
        .where(eq(attendance.id, existing[0].id))
        .returning();
      return c.json(result[0], 200);
    } else {
      // Create new record
      const result = await db
        .insert(attendance)
        .values({
          id: crypto.randomUUID(),
          eventId: validated.eventId,
          patronId: validated.patronId,
          attended: true,
          checkInTime: new Date(),
          checkOutTime: null,
        })
        .returning();
      return c.json(result[0], 201);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error checking in:', error);
    return c.json({ error: 'Failed to check in' }, 500);
  }
});

// POST /api/attendance/check-out - Check-out from event
attendanceRouter.post('/check-out', async (c) => {
  try {
    const db = await getDatabase();
    const body = await c.req.json();
    const validated = CheckInSchema.parse(body);

    const existing = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.eventId, validated.eventId),
          eq(attendance.patronId, validated.patronId)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return c.json({ error: 'Attendance record not found' }, 404);
    }

    const result = await db
      .update(attendance)
      .set({ checkOutTime: new Date() })
      .where(eq(attendance.id, existing[0].id))
      .returning();

    return c.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error checking out:', error);
    return c.json({ error: 'Failed to check out' }, 500);
  }
});

// PUT /api/attendance/:id - Update attendance
attendanceRouter.put('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');
    const body = await c.req.json();

    // Convert date strings to Date objects if present
    const processedBody: any = { ...body };
    if (body.checkInTime) processedBody.checkInTime = new Date(body.checkInTime);
    if (body.checkOutTime) processedBody.checkOutTime = new Date(body.checkOutTime);

    const validated = UpdateAttendanceSchema.parse(processedBody);

    const result = await db
      .update(attendance)
      .set(validated)
      .where(eq(attendance.id, id))
      .returning();

    if (!result[0]) {
      return c.json({ error: 'Attendance record not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error updating attendance:', error);
    return c.json({ error: 'Failed to update attendance record' }, 500);
  }
});

// DELETE /api/attendance/:id - Delete attendance record
attendanceRouter.delete('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');

    const existing = await db
      .select()
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);

    if (!existing[0]) {
      return c.json({ error: 'Attendance record not found' }, 404);
    }

    await db.delete(attendance).where(eq(attendance.id, id));

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return c.json({ error: 'Failed to delete attendance record' }, 500);
  }
});

export default attendanceRouter;
