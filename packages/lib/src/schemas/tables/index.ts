// ============================================================================
// FILE: packages/lib/src/schemas/tables/index.ts
// Barrel export for all table definitions with relations
// ============================================================================

import { relations } from 'drizzle-orm';
import { users } from './users';
import { organizations } from './organizations';
import { orgMemberships } from './org-memberships';
import { events } from './events';
import { eventMembers } from './event-members';
import { attendance } from './attendance';
import { loyalty } from './loyalty';

// Re-export all tables
export { users } from './users';
export { organizations } from './organizations';
export { orgMemberships } from './org-memberships';
export { events } from './events';
export { eventMembers } from './event-members';
export { attendance } from './attendance';
export { loyalty } from './loyalty';

// ============================================================================
// Drizzle Relations
// ============================================================================

// Users can belong to multiple organizations and manage multiple events
export const usersRelations = relations(users, ({ many }) => ({
  orgMemberships: many(orgMemberships),
  eventMemberships: many(eventMembers),
  attendances: many(attendance),
  loyaltyRecords: many(loyalty),
}));

// Organizations are the tenant boundary
export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(orgMemberships),
  events: many(events),
  attendances: many(attendance),
  loyaltyRecords: many(loyalty),
}));

// Org memberships link users to organizations with roles
export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  user: one(users, {
    fields: [orgMemberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [orgMemberships.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [orgMemberships.invitedBy],
    references: [users.id],
  }),
}));

// Events belong to organizations and have multiple members
export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  members: many(eventMembers),
  attendances: many(attendance),
}));

// Event members link users to events with roles (replaces hostId)
export const eventMembersRelations = relations(eventMembers, ({ one }) => ({
  event: one(events, {
    fields: [eventMembers.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventMembers.userId],
    references: [users.id],
  }),
}));

// Attendance tracks check-ins for events
export const attendanceRelations = relations(attendance, ({ one }) => ({
  organization: one(organizations, {
    fields: [attendance.organizationId],
    references: [organizations.id],
  }),
  event: one(events, {
    fields: [attendance.eventId],
    references: [events.id],
  }),
  patron: one(users, {
    fields: [attendance.patronId],
    references: [users.id],
  }),
}));

// Loyalty records track points and rewards per organization
export const loyaltyRelations = relations(loyalty, ({ one }) => ({
  organization: one(organizations, {
    fields: [loyalty.organizationId],
    references: [organizations.id],
  }),
  patron: one(users, {
    fields: [loyalty.patronId],
    references: [users.id],
  }),
}));

// Schema object for drizzle client
export const schema = {
  // Tables
  users,
  organizations,
  orgMemberships,
  events,
  eventMembers,
  attendance,
  loyalty,
  // Relations
  usersRelations,
  organizationsRelations,
  orgMembershipsRelations,
  eventsRelations,
  eventMembersRelations,
  attendanceRelations,
  loyaltyRelations,
};

export type Schema = typeof schema;
