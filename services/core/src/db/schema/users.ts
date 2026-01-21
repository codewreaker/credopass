// ============================================================================
// FILE: packages/database/src/schema/users.ts
// User schema definition for Drizzle ORM (PostgreSQL/PGlite)
// ============================================================================

import { pgTable, text, timestamp, index, uuid } from 'drizzle-orm/pg-core';

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

// Relations will be defined in index.ts to avoid circular dependencies
export type UserTable = typeof users;
