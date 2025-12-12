// ============================================================================
// FILE: server/db/schema.ts
// Drizzle ORM schema definitions for all tables
// ============================================================================

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Users Table
// ============================================================================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  phone: text('phone'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  createdAtIdx: index('idx_users_createdAt').on(table.createdAt),
}));

// ============================================================================
// Events Table
// ============================================================================
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'] 
  }).notNull(),
  startTime: integer('startTime', { mode: 'timestamp_ms' }).notNull(),
  endTime: integer('endTime', { mode: 'timestamp_ms' }).notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity'),
  hostId: text('hostId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  statusIdx: index('idx_events_status').on(table.status),
  hostIdIdx: index('idx_events_hostId').on(table.hostId),
  startTimeIdx: index('idx_events_startTime').on(table.startTime),
}));

// ============================================================================
// Attendance Table
// ============================================================================
export const attendance = sqliteTable('attendance', {
  id: text('id').primaryKey(),
  eventId: text('eventId').notNull().references(() => events.id, { onDelete: 'cascade' }),
  patronId: text('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attended: integer('attended', { mode: 'boolean' }).notNull().default(false),
  checkInTime: integer('checkInTime', { mode: 'timestamp_ms' }),
  checkOutTime: integer('checkOutTime', { mode: 'timestamp_ms' }),
}, (table) => ({
  eventIdIdx: index('idx_attendance_eventId').on(table.eventId),
  patronIdIdx: index('idx_attendance_patronId').on(table.patronId),
  attendedIdx: index('idx_attendance_attended').on(table.attended),
  uniqueEventPatron: index('idx_attendance_unique').on(table.eventId, table.patronId),
}));

// ============================================================================
// Loyalty Table
// ============================================================================
export const loyalty = sqliteTable('loyalty', {
  id: text('id').primaryKey(),
  patronId: text('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  tier: text('tier', { 
    enum: ['bronze', 'silver', 'gold', 'platinum'] 
  }),
  points: integer('points').default(0),
  reward: text('reward'),
  issuedAt: integer('issuedAt', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }),
}, (table) => ({
  patronIdIdx: index('idx_loyalty_patronId').on(table.patronId),
  tierIdx: index('idx_loyalty_tier').on(table.tier),
}));

// ============================================================================
// Relations
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

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;

export type Loyalty = typeof loyalty.$inferSelect;
export type NewLoyalty = typeof loyalty.$inferInsert;
