// ============================================================================
// FILE: packages/lib/src/schemas/user.schema.ts
// User validation schemas generated from Drizzle table definitions
// ============================================================================

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users } from './tables/users';
import { z } from 'zod';

// Base user schema (SELECT from database)
export const UserSchema = createSelectSchema(users);

// Schema for creating a new user (INSERT without auto-generated fields)
export const CreateUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  firstName: z.string().min(1, 'Firstname should be more than a character'),
  lastName: z.string().min(1),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Schema for updating a user (all fields optional)
export const UpdateUserSchema = CreateUserSchema.partial();

// Schema for inserting a user (with optional id/timestamps for upserts)
export const InsertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

// TypeScript types inferred from Zod schemas
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type InsertUser = z.infer<typeof InsertUserSchema>;

// Aliases for backwards compatibility
export type UserType = User;
export type NewUser = CreateUser;
export type UserInsert = InsertUser;

// Select schema (for query results)
export const SelectUserSchema = UserSchema;
export type SelectUser = User;

