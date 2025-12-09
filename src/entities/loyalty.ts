import { LoyaltyTierEnum, type LoyaltyTier, type LoyaltyType } from "./schemas";


const LOYALTY_DESCRIPTIONS: Record<LoyaltyTier, string> = {
    [LoyaltyTierEnum.enum.bronze]: "Bronze Loyalty Tier",
    [LoyaltyTierEnum.enum.silver]: "Silver Loyalty Tier",
    [LoyaltyTierEnum.enum.gold]: "Gold Loyalty Tier",
    [LoyaltyTierEnum.enum.platinum]: "Platinum Loyalty Tier"
}

const YEAR_IN_MS = 1825 * 24 * 60 * 60 * 1000; //5 years

export class Loyalty implements LoyaltyType {
    id!: string
    patronId!: string
    description!: string
    issuedAt!: Date
    tier!: LoyaltyTier
    points?: number
    reward?: string
    expiresAt!: Date

    constructor(patronId: string ) {
        this.id = crypto.randomUUID()
        this.patronId = patronId
        this.tier = LoyaltyTierEnum.enum.bronze
        this.description = LOYALTY_DESCRIPTIONS[this.tier]
        this.issuedAt = new Date()
        this.expiresAt = new Date(Date.now() + YEAR_IN_MS)
    }

    setTier(tier: LoyaltyTier): void {
        this.tier = tier
        this.description = LOYALTY_DESCRIPTIONS[this.tier]
    }
}