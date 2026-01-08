// ============================================================================
// FILE: packages/validation/src/schemas/event.schema.ts
// Event validation schemas using Zod
// ============================================================================

import { z } from 'zod';
import { EventStatusEnum } from './enums';

// Base event schema with all fields
export const EventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: EventStatusEnum,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().min(1),
  capacity: z.number().int().positive().nullable(),
  hostId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Schema for creating a new event (no id, timestamps)
export const CreateEventSchema = EventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for updating an event (all fields optional)
export const UpdateEventSchema = CreateEventSchema.partial();

// Schema for inserting an event (with optional id for upserts)
export const InsertEventSchema = EventSchema.extend({
  id: z.string().uuid().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
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
export type EventInsert = z.infer<typeof EventSchema>;

// Select schema (for query results)
export const SelectEventSchema = EventSchema;
export type SelectEvent = Event;
