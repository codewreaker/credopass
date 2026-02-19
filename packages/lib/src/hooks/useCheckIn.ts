/**
 * useCheckIn Hook
 * Thin React wrapper around CheckInService
 */

import { useState, useCallback } from 'react';
import { processQRCheckIn, processManualCheckIn, validateAndCheckIn } from '../services/CheckInService';

export function useCheckIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrCheckIn = useCallback(async (qrCode: string) => {
    try {
      setLoading(true);
      const result = await processQRCheckIn(qrCode);
      setError(result.error || null);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'QR check-in failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const manualCheckIn = useCallback(async (eventId: string, memberId: string) => {
    try {
      setLoading(true);
      const result = await processManualCheckIn(eventId, memberId);
      setError(result.error || null);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Manual check-in failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const checkIn = useCallback(async (eventId: string, memberId: string, qrCode?: string) => {
    try {
      setLoading(true);
      const result = await validateAndCheckIn(eventId, memberId, qrCode);
      setError(result.error || null);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Check-in failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    qrCheckIn,
    manualCheckIn,
    checkIn,
  };
}
