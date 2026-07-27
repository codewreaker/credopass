// ============================================================================
// FILE: packages/lib/src/schemas/tables/organizations.ts
// THE tenant boundary. docs/API-FIRST-REBUILD.md §3.2, D7
// ============================================================================

import { pgTable, text, timestamp, index, uuid, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * One tenant boundary, full stop (D7).
 *
 * No nested `groups` entity and no rename to `workspace`. Both alternatives add
 * a second scoping dimension to every query and every RLS policy — the exact
 * complexity that produced the mess this rebuild is undoing. What organisations
 * were being abused for splits cleanly: recurring programmes become
 * `event_series`, and segments of people become `person_tags`.
 *
 * Dropped from the old shape: `external_auth_endpoint` and
 * `external_auth_api_key`. Nothing ever implemented them, and storing an API
 * key in a plain column is not how that should come back (D-I).
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),

  name: text('name').notNull(),
  slug: text('slug').notNull(),

  plan: text('plan', { enum: ['free', 'starter', 'pro', 'enterprise'] })
    .notNull()
    .default('free'),

  // The org's default event timezone. Recurrence needs it (D3), and so does
  // anything that renders a wall-clock time.
  timezone: text('timezone').notNull().default('UTC'),

  // Non-relational preferences. Never queried on — the moment something here
  // needs an index it deserves a column.
  settings: jsonb('settings').notNull().default({}),

  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),

  deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_organizations_slug').on(table.slug),
  index('idx_organizations_plan').on(table.plan),
  index('idx_organizations_stripe_customer').on(table.stripeCustomerId),
]).enableRLS();

export type OrganizationTable = typeof organizations;
