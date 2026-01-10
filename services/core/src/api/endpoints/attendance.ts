// ============================================================================
// FILE: packages/api-client/src/endpoints/attendance.ts
// Attendance API endpoints
// ============================================================================

import type { ApiClient } from '../client';
import type { Attendance, CreateAttendance, UpdateAttendance, CheckInInput } from 'packages/lib/src';

export interface AttendanceStats {
  total: number;
  attended: number;
  checkedIn: number;
  checkedOut: number;
}

export function createAttendanceApi(client: ApiClient) {
  return {
    /**
     * Get all attendance records, optionally filtered by eventId or patronId
     */
    getAll: (params?: { eventId?: string; patronId?: string }) =>
      client.get<Attendance[]>('/api/attendance', params as Record<string, string>),

    /**
     * Get an attendance record by ID
     */
    getById: (id: string) => client.get<Attendance>(`/api/attendance/${id}`),

    /**
     * Get attendance stats for an event
     */
    getEventStats: (eventId: string) =>
      client.get<AttendanceStats>(`/api/attendance/event/${eventId}/stats`),

    /**
     * Create a new attendance record
     */
    create: (data: CreateAttendance) =>
      client.post<Attendance, CreateAttendance>('/api/attendance', data),

    /**
     * Update an attendance record
     */
    update: (id: string, data: UpdateAttendance) =>
      client.put<Attendance, UpdateAttendance>(`/api/attendance/${id}`, data),

    /**
     * Delete an attendance record
     */
    delete: (id: string) => client.delete(`/api/attendance/${id}`),

    /**
     * Check in a patron to an event
     */
    checkIn: (data: CheckInInput) =>
      client.post<Attendance, CheckInInput>('/api/attendance/check-in', data),

    /**
     * Check out a patron from an event
     */
    checkOut: (data: CheckInInput) =>
      client.post<Attendance, CheckInInput>('/api/attendance/check-out', data),

    /**
     * Get attendance records for a specific patron
     */
    getByPatron: (patronId: string) =>
      client.get<Attendance[]>('/api/attendance', { patronId }),

    /**
     * Get attendance records for a specific event
     */
    getByEvent: (eventId: string) =>
      client.get<Attendance[]>('/api/attendance', { eventId }),
  };
}

export type AttendanceApi = ReturnType<typeof createAttendanceApi>;
