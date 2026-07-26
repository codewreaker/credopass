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

// Rebuild tables (Phase 1) — docs/API-FIRST-REBUILD.md §3.2
import { accounts } from './accounts';
import { identities } from './identities';
import { people } from './people';
import { invitations } from './invitations';
import { orgIdentityProviders, orgDomains } from './org-identity-providers';

// Re-export all tables
export { users } from './users';
export { organizations } from './organizations';
export { orgMemberships } from './org-memberships';
export { events } from './events';
export { eventMembers } from './event-members';
export { attendance } from './attendance';
export { loyalty } from './loyalty';

// Rebuild tables. `users` is being split: `accounts` (who signs in) +
// `people` (tenant-scoped attendee records) + `identities` (the join to any
// IdP). Both sets coexist through Phase 2; Phase 3 removes the old ones.
export { accounts } from './accounts';
export { identities } from './identities';
export { people } from './people';
export { invitations } from './invitations';
export { orgIdentityProviders, orgDomains } from './org-identity-providers';
export { orgRole, eventRole, provisionedBy, identityProviderKind } from './enums';

// ============================================================================
// Drizzle Relations
// ============================================================================

// Users can belong to multiple organizations and manage multiple events
export const usersRelations = relations(users, ({ many }) => ({
  // Memberships where this user is the member (disambiguated with relationName)
  orgMemberships: many(orgMemberships, { relationName: 'membershipUser' }),
  // Memberships where this user invited someone (disambiguated with relationName)
  invitedMemberships: many(orgMemberships, { relationName: 'membershipInviter' }),
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
    relationName: 'membershipUser',
  }),
  organization: one(organizations, {
    fields: [orgMemberships.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [orgMemberships.invitedBy],
    references: [users.id],
    relationName: 'membershipInviter',
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

// ============================================================================
// Rebuild relations (Phase 1)
// ============================================================================

// An account is a human who signs in. It has NO organization of its own — it
// reaches organisations only through memberships, and its own attendee records
// only through `people`. Those two paths never meet (§1.1 rule 6).
export const accountsRelations = relations(accounts, ({ many }) => ({
  identities: many(identities),
  orgMemberships: many(orgMemberships, { relationName: 'membershipAccount' }),
  people: many(people),
}));

export const identitiesRelations = relations(identities, ({ one }) => ({
  account: one(accounts, {
    fields: [identities.accountId],
    references: [accounts.id],
  }),
  identityProvider: one(orgIdentityProviders, {
    fields: [identities.orgIdentityProviderId],
    references: [orgIdentityProviders.id],
  }),
}));

export const peopleRelations = relations(people, ({ one }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  // Optional, and set only by claiming a verified email (D17).
  account: one(accounts, {
    fields: [people.accountId],
    references: [accounts.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(accounts, {
    fields: [invitations.invitedByAccountId],
    references: [accounts.id],
  }),
}));

export const orgIdentityProvidersRelations = relations(orgIdentityProviders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orgIdentityProviders.organizationId],
    references: [organizations.id],
  }),
  identities: many(identities),
}));

export const orgDomainsRelations = relations(orgDomains, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgDomains.organizationId],
    references: [organizations.id],
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
  // Rebuild tables
  accounts,
  identities,
  people,
  invitations,
  orgIdentityProviders,
  orgDomains,
  // Rebuild relations
  accountsRelations,
  identitiesRelations,
  peopleRelations,
  invitationsRelations,
  orgIdentityProvidersRelations,
  orgDomainsRelations,
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
