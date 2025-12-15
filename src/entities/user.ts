import { Loyalty } from "./loyalty.js";
import { Attendance } from "./attendance.js";
import { UserSchema, type UserType, type LoyaltyTier } from "../db/schema.js";

export class User implements UserType {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
  phone: string | null;
  loyaltyTier: Loyalty;
  attendance: Attendance | null;

  constructor(
    firstName: string,
    lastName: string,
    email: string,
    phone?: string
  ) {
    this.id = crypto.randomUUID();
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.phone = phone ?? null;
    this.loyaltyTier = new Loyalty(this.id);
    this.attendance = null;
  }

  validate(): void {
    UserSchema.parse(this);
  }

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  setLoyaltyTier(tier: LoyaltyTier): void {
    this.loyaltyTier.setTier(tier);
  }
}
