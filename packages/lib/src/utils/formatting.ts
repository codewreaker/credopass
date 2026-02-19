/**
 * Formatting Utilities
 * Helper functions for formatting various data types
 */

import { rewardTiers, type Tier } from '../constants';

export function calculateTier(totalPoints: number): Tier {
  if (totalPoints >= 10000) return rewardTiers.PLATINUM;
  if (totalPoints >= 5000) return rewardTiers.GOLD;
  if (totalPoints >= 2000) return rewardTiers.SILVER;
  return rewardTiers.BRONZE;
}

export function formatPoints(points: number): string {
  return points.toLocaleString();
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
