export type Tier = (typeof rewardTiers)[keyof typeof rewardTiers];

export const rewardTiers = {
    BRONZE: 'bronze',
    SILVER: 'silver',
    GOLD: 'gold',
    PLATINUM: 'platinum',
} as const; 