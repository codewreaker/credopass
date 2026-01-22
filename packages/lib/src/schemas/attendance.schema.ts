// ============================================================================
// FILE: packages/lib/src/schemas/attendance.schema.ts
// Attendance validation schemas generated from Drizzle table definitions
// ============================================================================

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { attendance } from './tables/attendance';
import { z } from 'zod';
import { CheckInMethodEnum } from './enums';

// Base attendance schema (SELECT from database)
export const AttendanceSchema = createSelectSchema(attendance, {
  checkInMethod: CheckInMethodEnum.nullable(),
});

// Schema for creating a new attendance record
export const CreateAttendanceSchema = createInsertSchema(attendance, {
  checkInMethod: CheckInMethodEnum.nullable(),
}).omit({ 
  id: true 
});

// Schema for updating an attendance record
export const UpdateAttendanceSchema = CreateAttendanceSchema.partial();

// Schema for check-in operation
export const CheckInSchema = z.object({
  eventId: z.string().uuid(),
  patronId: z.string().uuid(),
  organizationId: z.string().uuid(),
  checkInMethod: CheckInMethodEnum.optional(),
  notes: z.string().optional(),
});

// Schema for check-out operation
export const CheckOutSchema = z.object({
  eventId: z.string().uuid(),
  patronId: z.string().uuid(),
  notes: z.string().optional(),
});

// Schema for inserting attendance (with optional id for upserts)
export const InsertAttendanceSchema = createInsertSchema(attendance, {
  checkInMethod: CheckInMethodEnum.nullable(),
});

// TypeScript types inferred from Zod schemas
export type Attendance = z.infer<typeof AttendanceSchema>;
export type CreateAttendance = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendance = z.infer<typeof UpdateAttendanceSchema>;
export type CheckInInput = z.infer<typeof CheckInSchema>;
export type CheckOutInput = z.infer<typeof CheckOutSchema>;
export type InsertAttendance = z.infer<typeof InsertAttendanceSchema>;

// Aliases for backwards compatibility
export type AttendanceType = Attendance;
export type NewAttendance = CreateAttendance;
export type AttendanceInsert = InsertAttendance;

// Select schema (for query results)
export const SelectAttendanceSchema = AttendanceSchema;
export type SelectAttendance = Attendance;

