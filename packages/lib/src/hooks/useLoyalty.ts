/**
 * useLoyalty Hook
 * Thin React wrapper around LoyaltyModel
 */

import { useState, useCallback } from 'react';
import { getLoyaltyByMember, awardPoints } from '../models/LoyaltyModel';

export function useLoyalty() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoyaltyByMember = useCallback(async (memberId: string) => {
    try {
      setLoading(true);
      const loyalty = await getLoyaltyByMember(memberId);
      setError(null);
      return loyalty;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch loyalty records');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const award = useCallback(async (
    memberId: string,
    organizationId: string,
    points: number,
    reason: string
  ) => {
    try {
      setLoading(true);
      const loyalty = await awardPoints(memberId, organizationId, points, reason);
      setError(null);
      return loyalty;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to award points');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getLoyaltyByMember: fetchLoyaltyByMember,
    awardPoints: award,
  };
}
