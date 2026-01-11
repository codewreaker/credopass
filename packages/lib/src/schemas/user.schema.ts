import { z } from 'zod';

// Base user schema with all fields
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1, 'Firstname should be more than a character'),
  lastName: z.string().min(1),
  phone: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Schema for creating a new user (no id, timestamps)
export const CreateUserSchema = UserSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Schema for updating a user (all fields optional except id)
export const UpdateUserSchema = CreateUserSchema.partial();

// Schema for inserting a user (with optional id for upserts)
export const InsertUserSchema = UserSchema.extend({
  id: z.string().uuid().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

// TypeScript types inferred from Zod schemas
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type InsertUser = z.infer<typeof InsertUserSchema>;

// Aliases for backwards compatibility
export type UserType = User;
export type NewUser = CreateUser;
export type UserInsert = z.infer<typeof UserSchema>;

// Select schema (for query results)
export const SelectUserSchema = UserSchema;
export type SelectUser = User;
