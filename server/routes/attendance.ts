// ============================================================================
// FILE: server/routes/attendance.ts
// Hono routes for attendance with Drizzle ORM
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { getDatabase, AttendanceOperations } from "../db";
import { AttendanceSchema, CheckInSchema } from '../../src/entities/schemas';

const attendance = new Hono();

// Validation schemas
const CreateAttendanceSchema = AttendanceSchema.omit({});
const UpdateAttendanceSchema = AttendanceSchema.partial().omit({ id: true });

// GET /api/attendance - Get all attendance records
attendance.get("/", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        
        const eventId = c.req.query("eventId");
        const patronId = c.req.query("patronId");
        
        let records;
        if (eventId) {
            records = await attendanceOps.findByEventId(eventId);
        } else if (patronId) {
            records = await attendanceOps.findByPatronId(patronId);
        } else {
            records = await attendanceOps.findAll();
        }
        
        return c.json(records);
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return c.json({ error: "Failed to fetch attendance records" }, 500);
    }
});

// GET /api/attendance/:id - Get attendance by ID
attendance.get("/:id", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        const id = c.req.param("id");
        const record = await attendanceOps.findById(id);

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
attendance.get("/event/:eventId/stats", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        const eventId = c.req.param("eventId");
        const stats = await attendanceOps.getEventStats(eventId);

        return c.json(stats);
    } catch (error) {
        console.error("Error fetching event stats:", error);
        return c.json({ error: "Failed to fetch event statistics" }, 500);
    }
});

// POST /api/attendance - Create attendance record
attendance.post("/", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.checkInTime) processedBody.checkInTime = new Date(body.checkInTime);
        if (body.checkOutTime) processedBody.checkOutTime = new Date(body.checkOutTime);
        
        const validated = CreateAttendanceSchema.parse(processedBody);
        const record = await attendanceOps.create(validated);
        
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
attendance.post("/checkin", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        const body = await c.req.json();
        const validated = CheckInSchema.parse(body);
        
        // Generate UUID for new record
        const id = crypto.randomUUID();
        const record = await attendanceOps.checkIn(validated.eventId, validated.patronId, id);
        
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
attendance.post("/checkout", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        const body = await c.req.json();
        const validated = CheckInSchema.parse(body);
        
        const record = await attendanceOps.checkOut(validated.eventId, validated.patronId);
        
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
attendance.put("/:id", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        const id = c.req.param("id");
        const body = await c.req.json();
        
        // Convert date strings to Date objects if present
        const processedBody: any = { ...body };
        if (body.checkInTime) processedBody.checkInTime = new Date(body.checkInTime);
        if (body.checkOutTime) processedBody.checkOutTime = new Date(body.checkOutTime);
        
        const validated = UpdateAttendanceSchema.parse(processedBody);
        const record = await attendanceOps.update(id, validated);

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
attendance.delete("/:id", async (c) => {
    try {
        const db = getDatabase();
        const attendanceOps = new AttendanceOperations(db);
        const id = c.req.param("id");
        const deleted = await attendanceOps.delete(id);

        if (!deleted) {
            return c.json({ error: "Attendance record not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting attendance:", error);
        return c.json({ error: "Failed to delete attendance record" }, 500);
    }
});

export default attendance;