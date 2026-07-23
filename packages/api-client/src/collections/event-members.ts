// ============================================================================
// FILE: packages/api-client/src/collections/event-members.ts
// TanStack DB collection for Event Members — synced directly against Supabase.
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { z } from 'zod';
import { EventMemberSchema } from '@credopass/lib/schemas';
import { getSupabaseClient } from '../client';
import { supabaseCollectionOptionsWithDates } from './supabase-collection';

// Coerce ISO-string timestamps back into `Date` objects (see events.ts note).
const EventMemberCollectionSchema = EventMemberSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Create event members collection with a specific QueryClient.
 * Talks to the Supabase `event_members` table directly via PostgREST.
 */
export function createEventMemberCollection(queryClient: QueryClient) {
  return createCollection(
    supabaseCollectionOptionsWithDates({
      tableName: 'event_members',
      schema: EventMemberCollectionSchema,
      keys: ['id'],
      supabase: getSupabaseClient(),
      queryClient,
      dateFields: ['createdAt', 'updatedAt'],
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
// import { type EventMember } from '@credopass/lib/schemas';
// import { getAPIBaseURL, handleAPIErrors, authHeaders } from '../client';
//
// export function createEventMemberCollection(queryClient: QueryClient) {
//   return createCollection(
//     queryCollectionOptions({
//       queryKey: ['event-members'],
//       queryFn: async () => {
//         try {
//           const response = await fetch(`${getAPIBaseURL()}/event-members`, { headers: await authHeaders() });
//           const data = await response.json();
//           // Transform dates from the API response
//           return data.map((record: EventMember) => ({
//             ...record,
//             createdAt: new Date(record.createdAt),
//             updatedAt: new Date(record.updatedAt),
//           }));
//         } catch (error) {
//           throw `An error occurred while fetching event members: ${String(error)}. Please ensure the API server is running and accessible.`;
//         }
//       },
//       getKey: (item) => item.id,
//       queryClient,
//       schema: EventMemberSchema,
//
//       // Handle INSERT
//       onInsert: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { modified: newRecord } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/event-members`, {
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
//         const response = await fetch(`${getAPIBaseURL()}/event-members/${original.id}`, {
//           method: 'PUT',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(modified),
//         });
//         if (!response.ok) throw new Error('Failed to update event member');
//       },
//
//       // Handle DELETE
//       onDelete: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/event-members/${original.id}`, {
//           method: 'DELETE',
//           headers: await authHeaders(),
//         });
//         if (!response.ok) throw new Error('Failed to delete event member');
//       },
//     })
//   );
// }
