// ============================================================================
// FILE: server/db/operations/events.ts
// Event CRUD operations using Drizzle ORM
// ============================================================================

import { eq, desc, and, gte, lte } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { events, type Event, type NewEvent } from '../schema';

class EventOperations {
  private db: BunSQLiteDatabase;

  constructor(db: BunSQLiteDatabase) {
    this.db = db;
  }

  // Find all events
  async findAll(): Promise<Event[]> {
    return await this.db
      .select()
      .from(events)
      .orderBy(desc(events.startTime));
  }

  // Find event by ID
  async findById(id: string): Promise<Event | undefined> {
    const result = await this.db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);
    
    return result[0];
  }

  // Find events by status
  async findByStatus(status: Event['status']): Promise<Event[]> {
    return await this.db
      .select()
      .from(events)
      .where(eq(events.status, status))
      .orderBy(desc(events.startTime));
  }

  // Find events by host
  async findByHostId(hostId: string): Promise<Event[]> {
    return await this.db
      .select()
      .from(events)
      .where(eq(events.hostId, hostId))
      .orderBy(desc(events.startTime));
  }

  // Find events in date range
  async findByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
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
  }

  // Create new event
  async create(data: Omit<NewEvent, 'createdAt' | 'updatedAt'>): Promise<Event> {
    const now = new Date();
    const newEvent: NewEvent = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(events).values(newEvent);
    
    const created = await this.findById(newEvent.id);
    if (!created) {
      throw new Error('Failed to create event');
    }
    
    return created;
  }

  // Update event
  async update(id: string, data: Partial<Omit<NewEvent, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Event | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    await this.db
      .update(events)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id));

    return await this.findById(id);
  }

  // Delete event
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(events)
      .where(eq(events.id, id));

    return result.changes > 0;
  }

  // Update event status
  async updateStatus(id: string, status: Event['status']): Promise<Event | undefined> {
    return await this.update(id, { status });
  }
}

export default EventOperations;
