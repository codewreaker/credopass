// ============================================================================
// FILE: packages/lib/src/schemas/tables/index.ts
// The schema. docs/API-FIRST-REBUILD.md §3
// ============================================================================
//
// Ten tables, all snake_case, no legacy. Gone from the old shape:
//
//   users         → split into `accounts` (identity) + `people` (tenant-scoped)
//   event_members → narrowed to `event_grants` (delegation only; sign-ups are
//                   an `attendance` row with state = 'registered')
//   loyalty       → deleted outright (brief §4.1)
//
// ============================================================================

import { relations } from 'drizzle-orm';
import { accounts } from './accounts';
import { attendance } from './attendance';
import { deviceTokens } from './device-tokens';
import { eventGrants } from './event-grants';
import { events } from './events';
import { identities } from './identities';
import { invitations } from './invitations';
import { orgDomains, orgIdentityProviders } from './org-identity-providers';
import { orgMemberships } from './org-memberships';
import { organizations } from './organizations';
import { passes } from './passes';
import { people } from './people';

export { accounts } from './accounts';
export { attendance } from './attendance';
export { deviceTokens } from './device-tokens';
export { eventGrants } from './event-grants';
export { events } from './events';
export { identities } from './identities';
export { invitations } from './invitations';
export { orgDomains, orgIdentityProviders } from './org-identity-providers';
export { orgMemberships } from './org-memberships';
export { organizations } from './organizations';
export { passes } from './passes';
export { people } from './people';
export {
  attendanceState,
  checkInMethod,
  eventRole,
  identityProviderKind,
  orgRole,
  provisionedBy,
} from './enums';

// ============================================================================
// Relations
// ============================================================================

/**
 * An account reaches organisations ONLY through memberships, and its own
 * attendee records ONLY through `people`. Those two paths never meet — which is
 * how "attending an event never grants access to the organisation running it"
 * is structural rather than a rule someone has to remember (§1.1 rule 6).
 */
export const accountsRelations = relations(accounts, ({ many }) => ({
  identities: many(identities),
  orgMemberships: many(orgMemberships),
  people: many(people),
  eventGrants: many(eventGrants),
}));

export const identitiesRelations = relations(identities, ({ one }) => ({
  account: one(accounts, { fields: [identities.accountId], references: [accounts.id] }),
  identityProvider: one(orgIdentityProviders, {
    fields: [identities.orgIdentityProviderId],
    references: [orgIdentityProviders.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(orgMemberships),
  people: many(people),
  events: many(events),
  invitations: many(invitations),
  identityProviders: many(orgIdentityProviders),
  domains: many(orgDomains),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMemberships.organizationId],
    references: [organizations.id],
  }),
  account: one(accounts, { fields: [orgMemberships.accountId], references: [accounts.id] }),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  // Optional, and set only by claiming a verified email (D17) — never by
  // registering for an event.
  account: one(accounts, { fields: [people.accountId], references: [accounts.id] }),
  attendance: many(attendance),
  passes: many(passes),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  attendance: many(attendance),
  grants: many(eventGrants),
  passes: many(passes),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  organization: one(organizations, {
    fields: [attendance.organizationId],
    references: [organizations.id],
  }),
  event: one(events, { fields: [attendance.eventId], references: [events.id] }),
  person: one(people, { fields: [attendance.personId], references: [people.id] }),
}));

export const eventGrantsRelations = relations(eventGrants, ({ one }) => ({
  event: one(events, { fields: [eventGrants.eventId], references: [events.id] }),
  account: one(accounts, { fields: [eventGrants.accountId], references: [accounts.id] }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  organization: one(organizations, {
    fields: [deviceTokens.organizationId],
    references: [organizations.id],
  }),
  event: one(events, { fields: [deviceTokens.eventId], references: [events.id] }),
}));

export const passesRelations = relations(passes, ({ one }) => ({
  event: one(events, { fields: [passes.eventId], references: [events.id] }),
  person: one(people, { fields: [passes.personId], references: [people.id] }),
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

export const schema = {
  accounts,
  identities,
  organizations,
  orgMemberships,
  orgIdentityProviders,
  orgDomains,
  invitations,
  people,
  events,
  eventGrants,
  attendance,
  passes,
  deviceTokens,
  accountsRelations,
  identitiesRelations,
  organizationsRelations,
  orgMembershipsRelations,
  peopleRelations,
  eventsRelations,
  attendanceRelations,
  eventGrantsRelations,
  passesRelations,
  deviceTokensRelations,
  invitationsRelations,
  orgIdentityProvidersRelations,
  orgDomainsRelations,
};

export type Schema = typeof schema;
