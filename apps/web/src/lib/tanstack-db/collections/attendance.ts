// ============================================================================
// FILE: packages/tanstack-db/src/collections/attendance.ts
// TanStack DB collection for Attendance
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { Attendance } from '@credopass/lib/schemas';
import { API_BASE_URL } from '../../../config';
import { handleAPIErrors } from '..';

/**
 * Create attendance collection with a specific QueryClient
 */
export function createAttendanceCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['attendance'],
      queryFn: async (): Promise<Attendance[]> => {
        try {
          const response = await fetch(`${API_BASE_URL}/attendance`);
          const data = await response.json();
          // Transform dates from the API response
          return data.map((record: Attendance) => ({
            ...record,
            checkInTime: record.checkInTime ? new Date(record.checkInTime) : null,
            checkOutTime: record.checkOutTime ? new Date(record.checkOutTime) : null,
          }));
        } catch (error) {
          throw `An error occurred while fetching attendance: ${String(error)}. Please ensure the API server is running and accessible.`;
        }
      },
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newRecord } = mutation;
        const response = await fetch(`${API_BASE_URL}/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecord),
        });
        await handleAPIErrors(response);
        return response.json();
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${API_BASE_URL}/attendance/${original.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modified),
        });
        if (!response.ok) throw new Error('Failed to update attendance record');
      },

      // Handle DELETE
      onDelete: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original } = mutation;
        const response = await fetch(`${API_BASE_URL}/attendance/${original.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete attendance record');
      },
    })
  );
}

export type AttendanceCollection = ReturnType<typeof createAttendanceCollection>;
