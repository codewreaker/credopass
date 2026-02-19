/**
 * useAttendance Hook
 * Thin React wrapper around AttendanceModel
 */

import { useState, useCallback } from 'react';
import { checkIn, checkInManual, getAttendanceByEvent } from '../models/AttendanceModel';
import type { Attendance } from '../schemas';

export function useAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkInMember = useCallback(async (eventId: string, memberId: string, qrCode?: string) => {
    try {
      setLoading(true);
      const attendance = await checkIn(eventId, memberId, qrCode);
      setError(null);
      return attendance;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkInMemberManual = useCallback(async (eventId: string, memberId: string) => {
    try {
      setLoading(true);
      const attendance = await checkInManual(eventId, memberId);
      setError(null);
      return attendance;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in manually');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAttendanceByEvent = useCallback(async (eventId: string) => {
    try {
      setLoading(true);
      const attendance = await getAttendanceByEvent(eventId);
      setError(null);
      return attendance;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    checkIn: checkInMember,
    checkInManual: checkInMemberManual,
    getAttendanceByEvent: fetchAttendanceByEvent,
  };
}
