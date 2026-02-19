/**
 * useAnalytics Hook
 * Thin React wrapper around AnalyticsModel
 */

import { useState, useCallback } from 'react';
import { getAttendanceSummary, getEventStats, getLoyaltyStats } from '../models/AnalyticsModel';

export function useAnalytics() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendanceSummary = useCallback(async (eventId: string) => {
    try {
      setLoading(true);
      const summary = await getAttendanceSummary(eventId);
      setError(null);
      return summary;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance summary');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEventStats = useCallback(async (organizationId?: string) => {
    try {
      setLoading(true);
      const stats = await getEventStats(organizationId);
      setError(null);
      return stats;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch event stats');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLoyaltyStats = useCallback(async (organizationId: string) => {
    try {
      setLoading(true);
      const stats = await getLoyaltyStats(organizationId);
      setError(null);
      return stats;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch loyalty stats');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getAttendanceSummary: fetchAttendanceSummary,
    getEventStats: fetchEventStats,
    getLoyaltyStats: fetchLoyaltyStats,
  };
}
