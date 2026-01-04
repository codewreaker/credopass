// ============================================================================
// FILE: server/db/schema.ts
// Drizzle ORM schema definitions for all tables (PostgreSQL/PGlite)
// Single source of truth for: Zod schemas, TypeScript types, and Drizzle tables
// ============================================================================

import { pgTable, text, integer, boolean, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// ============================================================================
// Zod Enums (Source of Truth)
// ============================================================================
export const EventStatusEnum = z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled']);
export const LoyaltyTierEnum = z.enum(['bronze', 'silver', 'gold', 'platinum']);
export const LiveUpdateTypeEnum = z.enum(['attendance_update', 'event_status_change', 'announcement', 'milestone', 'reward_earned']);

// ============================================================================
// Zod Schemas (Source of Truth)
// ============================================================================

// User Zod Schemas
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  firstName: z.string().min(1, "Firstname should be more than a character"),
  lastName: z.string().min(1),
  phone: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const UpdateUserSchema = CreateUserSchema.partial();

// Event Zod Schemas
export const EventSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: EventStatusEnum,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().min(1),
  capacity: z.number().int().positive().nullable(),
  hostId: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateEventSchema = EventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateEventSchema = CreateEventSchema.partial();

// Attendance Zod Schemas
export const AttendanceSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  patronId: z.uuid(),
  attended: z.boolean(),
  checkInTime: z.coerce.date().nullable(),
  checkOutTime: z.coerce.date().nullable(),
});

export const CreateAttendanceSchema = AttendanceSchema.omit({ id: true }).extend({
  attended: z.boolean().default(false),
  checkInTime: z.coerce.date().nullable().optional(),
  checkOutTime: z.coerce.date().nullable().optional(),
});

export const CheckInSchema = z.object({
  eventId: z.uuid(),
  patronId: z.uuid(),
});

// Loyalty Zod Schemas
export const LoyaltySchema = z.object({
  id: z.uuid(),
  patronId: z.uuid(),
  description: z.string(),
  tier: LoyaltyTierEnum.nullable(),
  points: z.number().int().nonnegative().nullable(),
  reward: z.string().nullable(),
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
});

export const CreateLoyaltySchema = LoyaltySchema.omit({ id: true });

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================
export type EventStatus = z.infer<typeof EventStatusEnum>;
export type LoyaltyTier = z.infer<typeof LoyaltyTierEnum>;
export type LiveUpdateType = z.infer<typeof LiveUpdateTypeEnum>;

export type User = z.infer<typeof UserSchema>;
export type NewUser = z.infer<typeof CreateUserSchema>;
// For database operations that require id, createdAt, updatedAt
export type UserInsert = z.infer<typeof UserSchema>;

export type Event = z.infer<typeof EventSchema>;
export type NewEvent = z.infer<typeof CreateEventSchema>;
export type CreateEventInput = NewEvent;
// For database operations that require id, createdAt, updatedAt
export type EventInsert = z.infer<typeof EventSchema>;

export type Attendance = z.infer<typeof AttendanceSchema>;
export type NewAttendance = z.infer<typeof CreateAttendanceSchema>;
// For database operations that require id
export type AttendanceInsert = z.infer<typeof AttendanceSchema>;

export type Loyalty = z.infer<typeof LoyaltySchema>;
export type NewLoyalty = z.infer<typeof CreateLoyaltySchema>;
// For database operations that require id
export type LoyaltyInsert = z.infer<typeof LoyaltySchema>;

export type CheckInInput = z.infer<typeof CheckInSchema>;

// Aliases for backwards compatibility
export type UserType = User;
export type AttendanceType = Attendance;
export type LoyaltyType = Loyalty;

// ============================================================================
// Drizzle Tables (for database operations) - PostgreSQL/PGlite
// ============================================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  phone: text('phone'),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_createdAt').on(table.createdAt),
]);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'] 
  }).notNull(),
  startTime: timestamp('startTime', { mode: 'date', withTimezone: true }).notNull(),
  endTime: timestamp('endTime', { mode: 'date', withTimezone: true }).notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity'),
  hostId: uuid('hostId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_events_status').on(table.status),
  index('idx_events_hostId').on(table.hostId),
  index('idx_events_startTime').on(table.startTime),
]);

export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('eventId').notNull().references(() => events.id, { onDelete: 'cascade' }),
  patronId: uuid('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attended: boolean('attended').notNull().default(false),
  checkInTime: timestamp('checkInTime', { mode: 'date', withTimezone: true }),
  checkOutTime: timestamp('checkOutTime', { mode: 'date', withTimezone: true }),
}, (table) => [
  index('idx_attendance_eventId').on(table.eventId),
  index('idx_attendance_patronId').on(table.patronId),
  index('idx_attendance_attended').on(table.attended),
  index('idx_attendance_unique').on(table.eventId, table.patronId),
]);

export const loyalty = pgTable('loyalty', {
  id: uuid('id').primaryKey().defaultRandom(),
  patronId: uuid('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  tier: text('tier', { 
    enum: ['bronze', 'silver', 'gold', 'platinum'] 
  }),
  points: integer('points').default(0),
  reward: text('reward'),
  issuedAt: timestamp('issuedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expiresAt', { mode: 'date', withTimezone: true }),
}, (table) => [
  index('idx_loyalty_patronId').on(table.patronId),
  index('idx_loyalty_tier').on(table.tier),
]);

// ============================================================================
// Drizzle Relations
// ============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  hostedEvents: many(events),
  attendances: many(attendance),
  loyaltyRecords: many(loyalty),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  host: one(users, {
    fields: [events.hostId],
    references: [users.id],
  }),
  attendances: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  event: one(events, {
    fields: [attendance.eventId],
    references: [events.id],
  }),
  patron: one(users, {
    fields: [attendance.patronId],
    references: [users.id],
  }),
}));

export const loyaltyRelations = relations(loyalty, ({ one }) => ({
  patron: one(users, {
    fields: [loyalty.patronId],
    references: [users.id],
  }),
}));
