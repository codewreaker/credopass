// ============================================================================
// FILE: packages/lib/src/schemas/tables/loyalty.ts
// Loyalty table definition for Drizzle ORM (PostgreSQL)
// ============================================================================

import { pgTable, text, integer, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { organizations } from './organizations';

export const loyalty = pgTable('loyalty', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Organization for tenant isolation
  organizationId: uuid('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Patron reference
  patronId: uuid('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Loyalty record details
  description: text('description').notNull(),
  tier: text('tier', { 
    enum: ['bronze', 'silver', 'gold', 'platinum'] 
  }),
  points: integer('points').default(0),
  reward: text('reward'),
  
  // Timestamps
  issuedAt: timestamp('issuedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expiresAt', { mode: 'date', withTimezone: true }), // null = never expires
}, (table) => [
  index('idx_loyalty_organizationId').on(table.organizationId),
  index('idx_loyalty_patronId').on(table.patronId),
  index('idx_loyalty_tier').on(table.tier),
  index('idx_loyalty_expiresAt').on(table.expiresAt),
]).enableRLS();

export type LoyaltyTable = typeof loyalty;
