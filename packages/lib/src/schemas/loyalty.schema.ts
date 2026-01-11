// ============================================================================
// FILE: packages/lib/src/schemas/loyalty.schema.ts
// Loyalty validation schemas generated from Drizzle table definitions
// ============================================================================

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { loyalty } from './tables/loyalty';
import { z } from 'zod';
import { LoyaltyTierEnum } from './enums';

// Base loyalty schema (SELECT from database)
export const LoyaltySchema = createSelectSchema(loyalty, {
  tier: LoyaltyTierEnum.nullable(),
});

// Schema for creating a new loyalty record
export const CreateLoyaltySchema = createInsertSchema(loyalty, {
  tier: LoyaltyTierEnum.nullable(),
  points: z.number().int().nonnegative().nullable(),
}).omit({ id: true });

// Schema for updating a loyalty record
export const UpdateLoyaltySchema = CreateLoyaltySchema.partial();

// Schema for awarding points
export const AwardPointsSchema = z.object({
  patronId: z.string().uuid(),
  points: z.number().int().positive(),
  description: z.string().min(1),
});

// Schema for awarding a reward
export const AwardRewardSchema = z.object({
  patronId: z.string().uuid(),
  reward: z.string().min(1),
  description: z.string().min(1),
  expiresAt: z.coerce.date().optional(),
});

// Schema for inserting loyalty (with optional id for upserts)
export const InsertLoyaltySchema = createInsertSchema(loyalty, {
  tier: LoyaltyTierEnum.nullable(),
  points: z.number().int().nonnegative().nullable(),
});

// TypeScript types inferred from Zod schemas
export type Loyalty = z.infer<typeof LoyaltySchema>;
export type CreateLoyalty = z.infer<typeof CreateLoyaltySchema>;
export type UpdateLoyalty = z.infer<typeof UpdateLoyaltySchema>;
export type AwardPoints = z.infer<typeof AwardPointsSchema>;
export type AwardReward = z.infer<typeof AwardRewardSchema>;
export type InsertLoyalty = z.infer<typeof InsertLoyaltySchema>;

// Aliases for backwards compatibility
export type LoyaltyType = Loyalty;
export type NewLoyalty = CreateLoyalty;
export type LoyaltyInsert = InsertLoyalty;

// Select schema (for query results)
export const SelectLoyaltySchema = LoyaltySchema;
export type SelectLoyalty = Loyalty;