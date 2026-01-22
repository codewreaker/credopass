// ============================================================================
// FILE: packages/lib/src/schemas/tables/users.ts
// User table definition for Drizzle ORM (PostgreSQL)
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
]).enableRLS();

export type UserTable = typeof users;
