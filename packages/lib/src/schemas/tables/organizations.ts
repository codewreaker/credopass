// ============================================================================
// FILE: packages/lib/src/schemas/tables/organizations.ts
// Organizations table definition for multi-tenant support
// ============================================================================

import { pgTable, text, timestamp, index, uuid } from 'drizzle-orm/pg-core';

/**
 * Organizations are the tenant boundary for multi-tenancy.
 * All events, members, and data belong to an organization.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Organization identity
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // URL-friendly identifier (e.g., "kharis-church")
  
  // Subscription plan for billing tiers
  plan: text('plan', { 
    enum: ['free', 'starter', 'pro', 'enterprise'] 
  }).notNull().default('free'),
  
  // Optional external auth integration for pulling member data
  externalAuthEndpoint: text('externalAuthEndpoint'), // e.g., "https://institution.edu/api/members"
  externalAuthApiKey: text('externalAuthApiKey'), // Encrypted API key for external auth
  
  // Stripe integration for billing
  stripeCustomerId: text('stripeCustomerId'),
  stripeSubscriptionId: text('stripeSubscriptionId'),
  
  // Soft delete support
  deletedAt: timestamp('deletedAt', { mode: 'date', withTimezone: true }),
  
  // Timestamps
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_organizations_slug').on(table.slug),
  index('idx_organizations_plan').on(table.plan),
  index('idx_organizations_stripeCustomerId').on(table.stripeCustomerId),
]).enableRLS();

export type OrganizationTable = typeof organizations;
