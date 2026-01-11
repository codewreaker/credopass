// Helper function to calculate tier from points

import { rewardTiers, type Tier } from "../constants";

export function calculateTier(totalPoints: number): Tier {
    if (totalPoints >= 10000) return rewardTiers.PLATINUM;
    if (totalPoints >= 5000) return rewardTiers.GOLD;
    if (totalPoints >= 2000) return rewardTiers.SILVER;
    return rewardTiers.BRONZE;
}
