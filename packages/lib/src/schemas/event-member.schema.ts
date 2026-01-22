// ============================================================================
// FILE: packages/lib/src/schemas/event-member.schema.ts
// Event member validation schemas (replaces hostId relationship)
// ============================================================================

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { eventMembers } from './tables/event-members';
import { z } from 'zod';
import { EventRoleEnum } from './enums';

// Base event member schema (SELECT from database)
export const EventMemberSchema = createSelectSchema(eventMembers, {
  role: EventRoleEnum,
});

// Schema for adding a member to an event
export const CreateEventMemberSchema = createInsertSchema(eventMembers, {
  role: EventRoleEnum,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for updating an event member (change role)
export const UpdateEventMemberSchema = z.object({
  role: EventRoleEnum.optional(),
});

// Schema for inserting event member (with optional id for upserts)
export const InsertEventMemberSchema = createInsertSchema(eventMembers, {
  role: EventRoleEnum,
});

// TypeScript types inferred from Zod schemas
export type EventMember = z.infer<typeof EventMemberSchema>;
export type CreateEventMember = z.infer<typeof CreateEventMemberSchema>;
export type UpdateEventMember = z.infer<typeof UpdateEventMemberSchema>;
export type InsertEventMember = z.infer<typeof InsertEventMemberSchema>;

// Select schema (for query results)
export const SelectEventMemberSchema = EventMemberSchema;
export type SelectEventMember = EventMember;
