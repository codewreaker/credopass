// ============================================================================
// FILE: packages/validation/src/schemas/attendance.schema.ts
// Attendance validation schemas using Zod
// ============================================================================

import { z } from 'zod';

// Base attendance schema with all fields
export const AttendanceSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  patronId: z.string().uuid(),
  attended: z.boolean(),
  checkInTime: z.coerce.date().nullable(),
  checkOutTime: z.coerce.date().nullable(),
});

// Schema for creating a new attendance record
export const CreateAttendanceSchema = AttendanceSchema.omit({ id: true }).extend({
  attended: z.boolean().default(false),
  checkInTime: z.coerce.date().nullable().optional(),
  checkOutTime: z.coerce.date().nullable().optional(),
});

// Schema for updating an attendance record
export const UpdateAttendanceSchema = CreateAttendanceSchema.partial();

// Schema for check-in operation
export const CheckInSchema = z.object({
  eventId: z.string().uuid(),
  patronId: z.string().uuid(),
});

// Schema for check-out operation
export const CheckOutSchema = z.object({
  eventId: z.string().uuid(),
  patronId: z.string().uuid(),
});

// Schema for inserting attendance (with optional id for upserts)
export const InsertAttendanceSchema = AttendanceSchema.extend({
  id: z.string().uuid().optional(),
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
export type AttendanceInsert = z.infer<typeof AttendanceSchema>;

// Select schema (for query results)
export const SelectAttendanceSchema = AttendanceSchema;
export type SelectAttendance = Attendance;
