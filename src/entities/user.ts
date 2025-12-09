import { Loyalty } from "./loyalty";
import { Attendance } from "./attendance";
import { UserSchema } from "./schemas";
import type { UserType, LoyaltyTier} from "./schemas";

export class User implements UserType {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  updatedAt: number;
  phone: string | undefined;
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
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.phone = phone;
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
