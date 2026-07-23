// ============================================================================
// FILE: packages/api-client/src/collections/attendance.ts
// TanStack DB collection for Attendance — synced directly against Supabase.
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { z } from 'zod';
import { AttendanceSchema } from '@credopass/lib/schemas';
import { getSupabaseClient } from '../client';
import { supabaseCollectionOptionsWithDates } from './supabase-collection';

// Coerce ISO-string timestamps back into `Date` objects (see events.ts note).
const AttendanceCollectionSchema = AttendanceSchema.extend({
  checkInTime: z.coerce.date().nullable(),
  checkOutTime: z.coerce.date().nullable(),
});

/**
 * Create attendance collection with a specific QueryClient.
 * Talks to the Supabase `attendance` table directly via PostgREST.
 */
export function createAttendanceCollection(queryClient: QueryClient) {
  return createCollection(
    supabaseCollectionOptionsWithDates({
      tableName: 'attendance',
      schema: AttendanceCollectionSchema,
      keys: ['id'],
      supabase: getSupabaseClient(),
      queryClient,
      dateFields: ['checkInTime', 'checkOutTime'],
      realtime: false,
    })
  );
}

// ============================================================================
// LEGACY — NOT USED
// The original drizzle-backed REST path (tanstack-db queryCollection ->
// /api/core -> drizzle -> Supabase). Kept for reference only.
// ----------------------------------------------------------------------------
// import { queryCollectionOptions } from '@tanstack/query-db-collection';
// import { type Attendance } from '@credopass/lib/schemas';
// import { getAPIBaseURL, handleAPIErrors, authHeaders } from '../client';
//
// export function createAttendanceCollection(queryClient: QueryClient) {
//   return createCollection(
//     queryCollectionOptions({
//       queryKey: ['attendance'],
//       queryFn: async () => {
//         try {
//           const response = await fetch(`${getAPIBaseURL()}/attendance`, { headers: await authHeaders() });
//           const data = await response.json();
//           // Transform dates from the API response
//           return data.map((record: Attendance) => ({
//             ...record,
//             checkInTime: record.checkInTime ? new Date(record.checkInTime) : null,
//             checkOutTime: record.checkOutTime ? new Date(record.checkOutTime) : null,
//           }));
//         } catch (error) {
//           throw `An error occurred while fetching attendance: ${String(error)}. Please ensure the API server is running and accessible.`;
//         }
//       },
//       schema: AttendanceSchema,
//       getKey: (item) => item.id,
//       queryClient,
//
//       // Handle INSERT
//       onInsert: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { modified: newRecord } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/attendance`, {
//           method: 'POST',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(newRecord),
//         });
//         await handleAPIErrors(response);
//         return response.json();
//       },
//
//       // Handle UPDATE
//       onUpdate: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original, modified } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/attendance/${original.id}`, {
//           method: 'PUT',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(modified),
//         });
//         if (!response.ok) throw new Error('Failed to update attendance record');
//       },
//
//       // Handle DELETE
//       onDelete: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/attendance/${original.id}`, {
//           method: 'DELETE',
//           headers: await authHeaders(),
//         });
//         if (!response.ok) throw new Error('Failed to delete attendance record');
//       },
//     })
//   );
// }
