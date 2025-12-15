// ============================================================================
// FILE: server/api/attendance.ts
// Attendance API - Using BaseAPI pattern
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from 'drizzle-orm';
import { BaseAPI } from './BaseAPI.js';
import { attendance, type Attendance, type AttendanceInsert, AttendanceSchema, CheckInSchema } from '../db/schema.js';

// ============================================================================
// AttendanceAPI - Extends BaseAPI with custom methods
// ============================================================================

class AttendanceAPI extends BaseAPI<Attendance, AttendanceInsert, typeof attendance> {
  protected readonly table = attendance;
  protected readonly tableName = 'attendance';

  async findByEventId(eventId: string): Promise<Attendance[]> {
    try {
      return await this.db
        .select()
        .from(attendance)
        .where(eq(attendance.eventId, eventId))
        .orderBy(desc(attendance.checkInTime));
    } catch (error) {
      throw new Error(`Failed to find attendance by event: ${error}`);
    }
  }

  async findByPatronId(patronId: string): Promise<Attendance[]> {
    try {
      return await this.db
        .select()
        .from(attendance)
        .where(eq(attendance.patronId, patronId))
        .orderBy(desc(attendance.checkInTime));
    } catch (error) {
      throw new Error(`Failed to find attendance by patron: ${error}`);
    }
  }

  async findByEventAndPatron(eventId: string, patronId: string): Promise<Attendance | undefined> {
    try {
      const result = await this.db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.eventId, eventId),
            eq(attendance.patronId, patronId)
          )
        )
        .limit(1);
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to find attendance by event and patron: ${error}`);
    }
  }

  async findAttendedByEvent(eventId: string): Promise<Attendance[]> {
    try {
      return await this.db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.eventId, eventId),
            eq(attendance.attended, true)
          )
        )
        .orderBy(desc(attendance.checkInTime));
    } catch (error) {
      throw new Error(`Failed to find attended records by event: ${error}`);
    }
  }

  async checkIn(eventId: string, patronId: string, id: string): Promise<Attendance> {
    try {
      const existing = await this.findByEventAndPatron(eventId, patronId);
      
      if (existing) {
        // Update existing record
        const updated = await this.update(existing.id, {
          attended: true,
          checkInTime: new Date(),
        });
        
        if (!updated) throw new Error('Failed to update attendance');
        return updated;
      } else {
        // Create new record
        return await this.create({
          id,
          eventId,
          patronId,
          attended: true,
          checkInTime: new Date(),
          checkOutTime: null,
        });
      }
    } catch (error) {
      throw new Error(`Failed to check in: ${error}`);
    }
  }

  async checkOut(eventId: string, patronId: string): Promise<Attendance | undefined> {
    try {
      const existing = await this.findByEventAndPatron(eventId, patronId);
      if (!existing) return undefined;

      return await this.update(existing.id, {
        checkOutTime: new Date(),
      });
    } catch (error) {
      throw new Error(`Failed to check out: ${error}`);
    }
  }

  async getEventStats(eventId: string): Promise<{
    total: number;
    attended: number;
    checkedIn: number;
    checkedOut: number;
  }> {
    try {
      const records = await this.findByEventId(eventId);
      
      return {
        total: records.length,
        attended: records.filter(r => r.attended).length,
        checkedIn: records.filter(r => r.checkInTime !== null).length,
        checkedOut: records.filter(r => r.checkOutTime !== null).length,
      };
    } catch (error) {
      throw new Error(`Failed to get event stats: ${error}`);
    }
  }
}

// Initialize API
const attendanceAPI = new AttendanceAPI();

// ============================================================================
// HTTP Routes
// ============================================================================

const attendanceRouter = new Hono();

// Validation schemas
const CreateAttendanceSchema = AttendanceSchema.omit({});
const UpdateAttendanceSchema = AttendanceSchema.partial().omit({ id: true });

// GET /api/attendance - Get all attendance records
attendanceRouter.get("/", async (c) => {
    try {
        const eventId = c.req.query("eventId");
        const patronId = c.req.query("patronId");
        
        let records;
        if (eventId) {
            records = await attendanceAPI.findByEventId(eventId);
        } else if (patronId) {
            records = await attendanceAPI.findByPatronId(patronId);
        } else {
            records = await attendanceAPI.findAll();
        }
        
        return c.json(records);
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return c.json({ error: "Failed to fetch attendance records" }, 500);
    }
});

// GET /api/attendance/:id - Get attendance by ID
attendanceRouter.get("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const record = await attendanceAPI.findById(id);

        if (!record) {
            return c.json({ error: "Attendance record not found" }, 404);
        }

        return c.json(record);
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return c.json({ error: "Failed to fetch attendance record" }, 500);
    }
});

// GET /api/attendance/event/:eventId/stats - Get event attendance stats
attendanceRouter.get("/event/:eventId/stats", async (c) => {
    try {
        const eventId = c.req.param("eventId");
        const stats = await attendanceAPI.getEventStats(eventId);

        return c.json(stats);
    } catch (error) {
        console.error("Error fetching event stats:", error);
        return c.json({ error: "Failed to fetch event statistics" }, 500);
    }
});

// POST /api/attendance - Create attendance record
attendanceRouter.post("/", async (c) => {
    try {
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.checkInTime) processedBody.checkInTime = new Date(body.checkInTime);
        if (body.checkOutTime) processedBody.checkOutTime = new Date(body.checkOutTime);
        
        const validated = CreateAttendanceSchema.parse(processedBody);
        const record = await attendanceAPI.create(validated);
        
        return c.json(record, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error creating attendance:", error);
        return c.json({ error: "Failed to create attendance record" }, 500);
    }
});

// POST /api/attendance/checkin - Check-in to event
attendanceRouter.post("/checkin", async (c) => {
    try {
        const body = await c.req.json();
        const validated = CheckInSchema.parse(body);
        
        // Generate UUID for new record
        const id = crypto.randomUUID();
        const record = await attendanceAPI.checkIn(validated.eventId, validated.patronId, id);
        
        return c.json(record, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error checking in:", error);
        return c.json({ error: "Failed to check in" }, 500);
    }
});

// POST /api/attendance/checkout - Check-out from event
attendanceRouter.post("/checkout", async (c) => {
    try {
        const body = await c.req.json();
        const validated = CheckInSchema.parse(body);
        
        const record = await attendanceAPI.checkOut(validated.eventId, validated.patronId);
        
        if (!record) {
            return c.json({ error: "Attendance record not found" }, 404);
        }
        
        return c.json(record);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error checking out:", error);
        return c.json({ error: "Failed to check out" }, 500);
    }
});

// PUT /api/attendance/:id - Update attendance
attendanceRouter.put("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.checkInTime) processedBody.checkInTime = new Date(body.checkInTime);
        if (body.checkOutTime) processedBody.checkOutTime = new Date(body.checkOutTime);
        
        const validated = UpdateAttendanceSchema.parse(processedBody);
        const record = await attendanceAPI.update(id, validated);

        if (!record) {
            return c.json({ error: "Attendance record not found" }, 404);
        }

        return c.json(record);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error updating attendance:", error);
        return c.json({ error: "Failed to update attendance record" }, 500);
    }
});

// DELETE /api/attendance/:id - Delete attendance record
attendanceRouter.delete("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const deleted = await attendanceAPI.delete(id);

        if (!deleted) {
            return c.json({ error: "Attendance record not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting attendance:", error);
        return c.json({ error: "Failed to delete attendance record" }, 500);
    }
});

export default attendanceRouter;
