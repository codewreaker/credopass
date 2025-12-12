// ============================================================================
// FILE: server/db/operations/attendance.ts
// Attendance CRUD operations using Drizzle ORM
// ============================================================================

import { eq, and, desc, isNotNull } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { attendance, type Attendance, type NewAttendance } from '../schema';

class AttendanceOperations {
  private db: BunSQLiteDatabase;

  constructor(db: BunSQLiteDatabase) {
    this.db = db;
  }

  // Find all attendance records
  async findAll(): Promise<Attendance[]> {
    return await this.db
      .select()
      .from(attendance)
      .orderBy(desc(attendance.checkInTime));
  }

  // Find attendance by ID
  async findById(id: string): Promise<Attendance | undefined> {
    const result = await this.db
      .select()
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);
    
    return result[0];
  }

  // Find attendance by event ID
  async findByEventId(eventId: string): Promise<Attendance[]> {
    return await this.db
      .select()
      .from(attendance)
      .where(eq(attendance.eventId, eventId))
      .orderBy(desc(attendance.checkInTime));
  }

  // Find attendance by patron ID
  async findByPatronId(patronId: string): Promise<Attendance[]> {
    return await this.db
      .select()
      .from(attendance)
      .where(eq(attendance.patronId, patronId))
      .orderBy(desc(attendance.checkInTime));
  }

  // Find specific attendance record
  async findByEventAndPatron(eventId: string, patronId: string): Promise<Attendance | undefined> {
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
  }

  // Get attended records for an event
  async findAttendedByEvent(eventId: string): Promise<Attendance[]> {
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
  }

  // Create new attendance record
  async create(data: NewAttendance): Promise<Attendance> {
    await this.db.insert(attendance).values(data);
    
    const created = await this.findById(data.id);
    if (!created) {
      throw new Error('Failed to create attendance record');
    }
    
    return created;
  }

  // Check-in patron to event
  async checkIn(eventId: string, patronId: string, id: string): Promise<Attendance> {
    const existing = await this.findByEventAndPatron(eventId, patronId);
    
    if (existing) {
      // Update existing record
      await this.db
        .update(attendance)
        .set({
          attended: true,
          checkInTime: new Date(),
        })
        .where(eq(attendance.id, existing.id));
      
      const updated = await this.findById(existing.id);
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
  }

  // Check-out patron from event
  async checkOut(eventId: string, patronId: string): Promise<Attendance | undefined> {
    const existing = await this.findByEventAndPatron(eventId, patronId);
    if (!existing) return undefined;

    await this.db
      .update(attendance)
      .set({
        checkOutTime: new Date(),
      })
      .where(eq(attendance.id, existing.id));

    return await this.findById(existing.id);
  }

  // Update attendance record
  async update(id: string, data: Partial<Omit<NewAttendance, 'id'>>): Promise<Attendance | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    await this.db
      .update(attendance)
      .set(data)
      .where(eq(attendance.id, id));

    return await this.findById(id);
  }

  // Delete attendance record
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(attendance)
      .where(eq(attendance.id, id));

    return result.changes > 0;
  }

  // Get attendance statistics for an event
  async getEventStats(eventId: string): Promise<{
    total: number;
    attended: number;
    checkedIn: number;
    checkedOut: number;
  }> {
    const records = await this.findByEventId(eventId);
    
    return {
      total: records.length,
      attended: records.filter(r => r.attended).length,
      checkedIn: records.filter(r => r.checkInTime !== null).length,
      checkedOut: records.filter(r => r.checkOutTime !== null).length,
    };
  }
}

export default AttendanceOperations;
