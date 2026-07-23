// ============================================================================
// FILE: packages/api-client/src/collections/organizations.ts
// TanStack DB collection for Organizations — synced directly against Supabase.
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { z } from 'zod';
import { OrganizationSchema } from '@credopass/lib/schemas';
import { getSupabaseClient } from '../client';
import { supabaseCollectionOptionsWithDates } from './supabase-collection';

// Coerce ISO-string timestamps back into `Date` objects (see events.ts note).
const OrganizationCollectionSchema = OrganizationSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});

/**
 * Create organization collection with a specific QueryClient.
 * Talks to the Supabase `organizations` table directly via PostgREST.
 */
export function createOrganizationCollection(queryClient: QueryClient) {
  return createCollection(
    supabaseCollectionOptionsWithDates({
      tableName: 'organizations',
      schema: OrganizationCollectionSchema,
      keys: ['id'],
      supabase: getSupabaseClient(),
      queryClient,
      dateFields: ['createdAt', 'updatedAt', 'deletedAt'],
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
// import { type Organization } from '@credopass/lib/schemas';
// import { getAPIBaseURL, handleAPIErrors, authHeaders } from '../client';
//
// export function createOrganizationCollection(queryClient: QueryClient) {
//   return createCollection(
//     queryCollectionOptions({
//       queryKey: ['organizations'],
//       queryFn: async () => {
//         const response = await fetch(`${getAPIBaseURL()}/organizations`, { headers: await authHeaders() });
//         if (!response.ok) throw new Error('Failed to fetch organizations');
//         const data = await response.json();
//         return data.map((org: Organization) => ({
//           ...org,
//           createdAt: new Date(org.createdAt),
//           updatedAt: new Date(org.updatedAt),
//           deletedAt: org.deletedAt ? new Date(org.deletedAt) : null
//         }));
//       },
//       schema: OrganizationSchema,
//       getKey: (item) => item.id,
//       queryClient,
//
//       // Handle INSERT
//       onInsert: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { modified: newOrg } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/organizations`, {
//           method: 'POST',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(newOrg),
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
//         const response = await fetch(`${getAPIBaseURL()}/organizations/${original.id}`, {
//           method: 'PUT',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(modified),
//         });
//         if (!response.ok) throw new Error('Failed to update organization');
//       },
//
//       // Handle DELETE
//       onDelete: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/organizations/${original.id}`, {
//           method: 'DELETE',
//           headers: await authHeaders(),
//         });
//         if (!response.ok) throw new Error('Failed to delete organization');
//       },
//     })
//   );
// }
