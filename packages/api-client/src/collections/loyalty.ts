// ============================================================================
// FILE: packages/api-client/src/collections/loyalty.ts
// TanStack DB collection for Loyalty — synced directly against Supabase.
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { z } from 'zod';
import { LoyaltySchema } from '@credopass/lib/schemas';
import { getSupabaseClient } from '../client';
import { supabaseCollectionOptionsWithDates } from './supabase-collection';

// Coerce ISO-string timestamps back into `Date` objects (see events.ts note).
const LoyaltyCollectionSchema = LoyaltySchema.extend({
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
});

/**
 * Create loyalty collection with a specific QueryClient.
 * Talks to the Supabase `loyalty` table directly via PostgREST.
 */
export function createLoyaltyCollection(queryClient: QueryClient) {
  return createCollection(
    supabaseCollectionOptionsWithDates({
      tableName: 'loyalty',
      schema: LoyaltyCollectionSchema,
      keys: ['id'],
      supabase: getSupabaseClient(),
      queryClient,
      dateFields: ['issuedAt', 'expiresAt'],
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
// import { type Loyalty } from '@credopass/lib/schemas';
// import { getAPIBaseURL, handleAPIErrors, authHeaders } from '../client';
//
// export function createLoyaltyCollection(queryClient: QueryClient) {
//   return createCollection(
//     queryCollectionOptions({
//       queryKey: ['loyalty'],
//       queryFn: async () => {
//         try {
//           const response = await fetch(`${getAPIBaseURL()}/loyalty`, { headers: await authHeaders() });
//           const data = await response.json();
//           // Transform dates from the API response
//           return data.map((record: Loyalty) => ({
//             ...record,
//             issuedAt: new Date(record.issuedAt),
//             expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
//           }));
//         } catch (error) {
//           throw `An error occurred while fetching loyalty records: ${String(error)}. Please ensure the API server is running and accessible.`;
//         }
//       },
//       schema: LoyaltySchema,
//       getKey: (item) => item.id,
//       queryClient,
//
//       // Handle INSERT
//       onInsert: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { modified: newRecord } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/loyalty`, {
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
//         const response = await fetch(`${getAPIBaseURL()}/loyalty/${original.id}`, {
//           method: 'PUT',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(modified),
//         });
//         if (!response.ok) throw new Error('Failed to update loyalty record');
//       },
//
//       // Handle DELETE
//       onDelete: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/loyalty/${original.id}`, {
//           method: 'DELETE',
//           headers: await authHeaders(),
//         });
//         if (!response.ok) throw new Error('Failed to delete loyalty record');
//       },
//     })
//   );
// }
