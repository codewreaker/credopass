/**
 * Utilities
 * Shared utility functions
 */


import { rewardTiers, type Tier } from "../constants";
export * from './qr-code';
export * from './events';
export * from './date';
export * from './formatting';


export function calculateTier(totalPoints: number): Tier {
    if (totalPoints >= 10000) return rewardTiers.PLATINUM;
    if (totalPoints >= 5000) return rewardTiers.GOLD;
    if (totalPoints >= 2000) return rewardTiers.SILVER;
    return rewardTiers.BRONZE;
}