import { z } from 'zod'

// Enums
export const EventStatusEnum = z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'])
export const LoyaltyTierEnum = z.enum(['bronze', 'silver', 'gold', 'platinum'])
export const LiveUpdateTypeEnum = z.enum(['attendance_update', 'event_status_change', 'announcement', 'milestone', 'reward_earned'])

export type EventStatus = z.infer<typeof EventStatusEnum>
export type LoyaltyTier = z.infer<typeof LoyaltyTierEnum>
export type LiveUpdateType = z.infer<typeof LiveUpdateTypeEnum>

// Patron
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string().min(1, "Firstname should be more than a character"),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional()
})

export type UserType = z.infer<typeof UserSchema>

// Event
export const EventSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: EventStatusEnum,
  startTime: z.date(),
  endTime: z.date(),
  location: z.string().min(1),
  capacity: z.number().int().positive().optional(),
  hostId: z.uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).refine((data) => data.endTime > data.startTime, {
  message: "End time must be after start time",
  path: ["endTime"],
})

export type Event = z.infer<typeof EventSchema>

export const CreateEventSchema = EventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateEventInput = z.infer<typeof CreateEventSchema>

// Attendance (includes check-in/check-out)
export const AttendanceSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  patronId: z.uuid(),
  attended: z.boolean(),
  checkInTime: z.date().nullable(),
  checkOutTime: z.date().nullable()
}).refine(
  (data) => {
    if (data.checkOutTime && data.checkInTime) {
      return data.checkOutTime >= data.checkInTime
    }
    return true
  },
  {
    message: "Check out time must be after or equal to check in time",
    path: ["checkOutTime"],
  }
)

export type AttendanceType = z.infer<typeof AttendanceSchema>

export const CheckInSchema = z.object({
  eventId: z.uuid(),
  patronId: z.uuid(),
})

export type CheckInInput = z.infer<typeof CheckInSchema>

// Loyalty (Account, Rewards, and Milestones)
export const LoyaltySchema = z.object({
  id: z.uuid(),
  patronId: z.uuid(),
  description: z.string(),
  tier: LoyaltyTierEnum.optional(),
  points: z.number().int().nonnegative().optional(),
  reward: z.string().optional(),
  issuedAt: z.date(),
  expiresAt: z.date().optional()
})

export type LoyaltyType = z.infer<typeof LoyaltySchema>
