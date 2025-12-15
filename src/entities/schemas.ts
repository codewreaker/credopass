// ============================================================================
// DEPRECATED: This file is kept for backwards compatibility.
// All schema definitions have been moved to src/db/schema.ts
// Please import from '../db/schema.js' instead.
// ============================================================================

// Re-export everything from the new unified schema location
export {
  // Enums
  EventStatusEnum,
  LoyaltyTierEnum,
  LiveUpdateTypeEnum,
  
  // Types
  type EventStatus,
  type LoyaltyTier,
  type LiveUpdateType,
  type User,
  type NewUser,
  type Event,
  type NewEvent,
  type Attendance,
  type NewAttendance,
  type Loyalty,
  type NewLoyalty,
  type UserType,
  type AttendanceType,
  type LoyaltyType,
  type CheckInInput,
  type CreateEventInput,
  
  // Zod Schemas
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  EventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  AttendanceSchema,
  CreateAttendanceSchema,
  CheckInSchema,
  LoyaltySchema,
  CreateLoyaltySchema,
} from '../db/schema.js';
