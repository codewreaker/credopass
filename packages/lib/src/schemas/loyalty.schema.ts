// ============================================================================
// FILE: packages/validation/src/schemas/loyalty.schema.ts
// Loyalty validation schemas using Zod
// ============================================================================

import { z } from 'zod';
import { LoyaltyTierEnum } from './enums';

// Base loyalty schema with all fields
export const LoyaltySchema = z.object({
  id: z.string().uuid(),
  patronId: z.string().uuid(),
  description: z.string(),
  tier: LoyaltyTierEnum.nullable(),
  points: z.number().int().nonnegative().nullable(),
  reward: z.string().nullable(),
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
});

// Schema for creating a new loyalty record
export const CreateLoyaltySchema = LoyaltySchema.omit({ id: true });

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
export const InsertLoyaltySchema = LoyaltySchema.extend({
  id: z.string().uuid().optional(),
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
export type LoyaltyInsert = z.infer<typeof LoyaltySchema>;

// Select schema (for query results)
export const SelectLoyaltySchema = LoyaltySchema;
export type SelectLoyalty = Loyalty;

// Helper function to calculate tier from points
export function calculateTier(totalPoints: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (totalPoints >= 10000) return 'platinum';
  if (totalPoints >= 5000) return 'gold';
  if (totalPoints >= 2000) return 'silver';
  return 'bronze';
}
