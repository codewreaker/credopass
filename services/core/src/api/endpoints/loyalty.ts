// ============================================================================
// FILE: packages/api-client/src/endpoints/loyalty.ts
// Loyalty API endpoints
// ============================================================================

import type { ApiClient } from '../client';
import type { Loyalty, CreateLoyalty, UpdateLoyalty, LoyaltyTier, AwardPoints, AwardReward } from '@credopass/lib';

export interface PatronPoints {
  patronId: string;
  totalPoints: number;
  tier: LoyaltyTier;
}

export function createLoyaltyApi(client: ApiClient) {
  return {
    /**
     * Get all loyalty records, optionally filtered by patronId or tier
     */
    getAll: (params?: { patronId?: string; tier?: LoyaltyTier }) =>
      client.get<Loyalty[]>('/api/loyalty', params as Record<string, string>),

    /**
     * Get a loyalty record by ID
     */
    getById: (id: string) => client.get<Loyalty>(`/api/loyalty/${id}`),

    /**
     * Get patron's total points and tier
     */
    getPatronPoints: (patronId: string) =>
      client.get<PatronPoints>(`/api/loyalty/patron/${patronId}/points`),

    /**
     * Get patron's reward history
     */
    getPatronRewards: (patronId: string) =>
      client.get<Loyalty[]>(`/api/loyalty/patron/${patronId}/rewards`),

    /**
     * Create a new loyalty record
     */
    create: (data: CreateLoyalty) =>
      client.post<Loyalty, CreateLoyalty>('/api/loyalty', data),

    /**
     * Update a loyalty record
     */
    update: (id: string, data: UpdateLoyalty) =>
      client.put<Loyalty, UpdateLoyalty>(`/api/loyalty/${id}`, data),

    /**
     * Delete a loyalty record
     */
    delete: (id: string) => client.delete(`/api/loyalty/${id}`),

    /**
     * Award points to a patron
     */
    awardPoints: (data: AwardPoints) =>
      client.post<Loyalty, AwardPoints>('/api/loyalty/award-points', data),

    /**
     * Award a reward to a patron
     */
    awardReward: (data: AwardReward) =>
      client.post<Loyalty, AwardReward>('/api/loyalty/award-reward', data),

    /**
     * Get loyalty leaderboard
     */
    getLeaderboard: (limit?: number) =>
      client.get<PatronPoints[]>('/api/loyalty/leaderboard', { limit: String(limit || 10) }),
  };
}

export type LoyaltyApi = ReturnType<typeof createLoyaltyApi>;
