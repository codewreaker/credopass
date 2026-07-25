// ============================================================================
// FILE: packages/lib/src/schemas/event.schema.ts
// Event validation schemas generated from Drizzle table definitions
// ============================================================================

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { events } from './tables/events';
import { z } from 'zod';
import { EventStatusEnum, CheckInMethodEnum } from './enums';

// Base event schema (SELECT from database)
export const EventSchema = createSelectSchema(events, {
  status: EventStatusEnum,
});

// Schema for creating a new event (INSERT without auto-generated fields)
export const CreateEventSchema = createInsertSchema(events, {
  name: z.string().min(1),
  location: z.string().min(1),
  status: EventStatusEnum,
  // `.nullish()`, not `.nullable()` — capacity is a nullable column, so omitting
  // it entirely has to be legal. `.nullable()` alone still demands the key.
  capacity: z.number().int().positive().nullish(),
  checkInMethods: z.array(CheckInMethodEnum).min(1),
  allowSelfCheckIn: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

// Schema for updating an event (all fields optional)
export const UpdateEventSchema = CreateEventSchema.partial();

// Schema for inserting an event (with optional id/timestamps for upserts)
export const InsertEventSchema = createInsertSchema(events, {
  name: z.string().min(1),
  location: z.string().min(1),
  status: EventStatusEnum,
  // `.nullish()`, not `.nullable()` — capacity is a nullable column, so omitting
  // it entirely has to be legal. `.nullable()` alone still demands the key.
  capacity: z.number().int().positive().nullish(),
  checkInMethods: z.array(CheckInMethodEnum).min(1),
  allowSelfCheckIn: z.boolean().default(true),
});

// TypeScript types inferred from Zod schemas
export type Event = z.infer<typeof EventSchema>;
export type CreateEvent = z.infer<typeof CreateEventSchema>;
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;
export type InsertEvent = z.infer<typeof InsertEventSchema>;

// Aliases for backwards compatibility
export type EventType = Event;
export type NewEvent = CreateEvent;
export type CreateEventInput = CreateEvent;
export type EventInsert = InsertEvent;

// Select schema (for query results)
export const SelectEventSchema = EventSchema;
export type SelectEvent = Event;

