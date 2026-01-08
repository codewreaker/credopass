// ============================================================================
// FILE: packages/validation/src/schemas/enums.ts
// Shared enum definitions using Zod
// ============================================================================

import { z } from 'zod';

// Event status enum
export const EventStatusEnum = z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled']);
export type EventStatus = z.infer<typeof EventStatusEnum>;

// Loyalty tier enum
export const LoyaltyTierEnum = z.enum(['bronze', 'silver', 'gold', 'platinum']);
export type LoyaltyTier = z.infer<typeof LoyaltyTierEnum>;

// Live update type enum (for real-time updates)
export const LiveUpdateTypeEnum = z.enum([
  'attendance_update',
  'event_status_change',
  'announcement',
  'milestone',
  'reward_earned'
]);
export type LiveUpdateType = z.infer<typeof LiveUpdateTypeEnum>;
