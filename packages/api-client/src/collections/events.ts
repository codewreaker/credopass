// ============================================================================
// FILE: packages/api-client/src/collections/events.ts
// TanStack DB collection for Events — synced directly against Supabase.
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { z } from 'zod';
import { EventSchema } from '@credopass/lib/schemas';
import { getSupabaseClient } from '../client';
import { supabaseCollectionOptionsWithDates } from './supabase-collection';

// PostgREST returns timestamps as ISO strings. TanStack DB validates the rows it
// receives from inserts/updates (and Realtime) against this schema, so the date
// columns are coerced back into `Date` objects to preserve the previous behaviour
// where collection rows always exposed real `Date` instances.
const EventCollectionSchema = EventSchema.extend({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});

/**
 * Create event collection with a specific QueryClient.
 *
 * Reads, writes and (optionally) Realtime sync go straight to the Supabase
 * `events` table via PostgREST — no drizzle-backed REST API in between.
 */
export function createEventCollection(queryClient: QueryClient) {
  return createCollection(
    supabaseCollectionOptionsWithDates({
      tableName: 'events',
      schema: EventCollectionSchema,
      keys: ['id'],
      supabase: getSupabaseClient(),
      queryClient,
      // Coerce these columns from ISO strings to Date on the read path.
      dateFields: ['startTime', 'endTime', 'createdAt', 'updatedAt', 'deletedAt'],
      // Live sync is opt-in: leave off to match the previous fetch-and-cache
      // behaviour, and until RLS policies are in place (see migration notes).
      realtime: false,
    })
  );
}

export type EventCollection = ReturnType<typeof createEventCollection>;

// ============================================================================
// LEGACY — NOT USED
// The original drizzle-backed REST path (tanstack-db queryCollection ->
// /api/core -> drizzle -> Supabase). Kept for reference; the app now talks to
// Supabase directly via supabaseCollectionOptions above.
// ----------------------------------------------------------------------------
// import { queryCollectionOptions } from '@tanstack/query-db-collection';
// import { type Event } from '@credopass/lib/schemas';
// import { getAPIBaseURL, handleAPIErrors, authHeaders } from '../client';
//
// const getStatus = (start: Date, status: Event['status']): Event['status'] => {
//   if (status == 'cancelled' || status === 'draft') return status;
//   const now = new Date();
//   return (start < now) ? 'completed' : 'scheduled';
// }
//
// export function createEventCollection(queryClient: QueryClient) {
//   return createCollection(
//     queryCollectionOptions({
//       queryKey: ['events'],
//       queryFn: async () => {
//         try {
//           const response = await fetch(`${getAPIBaseURL()}/events`, { headers: await authHeaders() });
//           const data = await response.json();
//           // Transform dates from the API response
//           return data.map((event: Event) => ({
//             ...event,
//             startTime: new Date(event.startTime),
//             endTime: new Date(event.endTime),
//             createdAt: new Date(event.createdAt),
//             updatedAt: new Date(event.updatedAt),
//             status: getStatus(new Date(event.startTime), event.status)
//           }));
//         } catch (error) {
//           throw `An error occurred while fetching events: ${String(error)}. Please ensure the API server is running and accessible.`;
//         }
//       },
//       schema: EventSchema,
//       getKey: (item) => item.id,
//       queryClient,
//
//       // Handle INSERT
//       onInsert: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { modified: newEvent } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/events`, {
//           method: 'POST',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(newEvent),
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
//         const response = await fetch(`${getAPIBaseURL()}/events/${original.id}`, {
//           method: 'PUT',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(modified),
//         });
//         if (!response.ok) throw new Error('Failed to update event');
//       },
//
//       // Handle DELETE
//       onDelete: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/events/${original.id}`, {
//           method: 'DELETE',
//           headers: await authHeaders(),
//         });
//         if (!response.ok) throw new Error('Failed to delete event');
//       },
//     })
//   );
// }
