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

// Organization plan enum
export const OrgPlanEnum = z.enum(['free', 'starter', 'pro', 'enterprise']);
export type OrgPlan = z.infer<typeof OrgPlanEnum>;

// Organization role enum
export const OrgRoleEnum = z.enum(['owner', 'admin', 'member', 'viewer']);
export type OrgRole = z.infer<typeof OrgRoleEnum>;

// Event member role enum
export const EventRoleEnum = z.enum(['organizer', 'co-host', 'staff', 'volunteer']);
export type EventRole = z.infer<typeof EventRoleEnum>;

// Check-in method enum
export const CheckInMethodEnum = z.enum(['qr', 'manual', 'external_auth']);
export type CheckInMethod = z.infer<typeof CheckInMethodEnum>;

// Live update type enum (for real-time updates)
export const LiveUpdateTypeEnum = z.enum([
  'attendance_update',
  'event_status_change',
  'announcement',
  'milestone',
  'reward_earned'
]);
export type LiveUpdateType = z.infer<typeof LiveUpdateTypeEnum>;
