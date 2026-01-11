// ============================================================================
// FILE: packages/lib/src/schemas/tables/loyalty.ts
// Loyalty table definition for Drizzle ORM (PostgreSQL)
// ============================================================================

import { pgTable, text, integer, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

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

export type LoyaltyTable = typeof loyalty;
