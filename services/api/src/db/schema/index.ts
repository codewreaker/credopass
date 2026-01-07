// ============================================================================
// FILE: packages/database/src/schema/index.ts
// Barrel export for all schema definitions with relations
// ============================================================================

import { relations } from 'drizzle-orm';
import { users } from './users';
import { events } from './events';
import { attendance } from './attendance';
import { loyalty } from './loyalty';

// Re-export all tables
export { users } from './users';
export { events } from './events';
export { attendance } from './attendance';
export { loyalty } from './loyalty';

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

// Schema object for drizzle client
export const schema = {
  users,
  events,
  attendance,
  loyalty,
  usersRelations,
  eventsRelations,
  attendanceRelations,
  loyaltyRelations,
};

export type Schema = typeof schema;
