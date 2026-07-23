// ============================================================================
// FILE: packages/api-client/src/collections/org-memberships.ts
// TanStack DB collection for Organization Memberships — synced directly against Supabase.
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { z } from 'zod';
import { OrgMembershipSchema } from '@credopass/lib/schemas';
import { getSupabaseClient } from '../client';
import { supabaseCollectionOptionsWithDates } from './supabase-collection';

// Coerce ISO-string timestamps back into `Date` objects (see events.ts note).
const OrgMembershipCollectionSchema = OrgMembershipSchema.extend({
  invitedAt: z.coerce.date().nullable(),
  acceptedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Create organization memberships collection with a specific QueryClient.
 * Talks to the Supabase `org_memberships` table directly via PostgREST.
 */
export function createOrgMembershipCollection(queryClient: QueryClient) {
  return createCollection(
    supabaseCollectionOptionsWithDates({
      tableName: 'org_memberships',
      schema: OrgMembershipCollectionSchema,
      keys: ['id'],
      supabase: getSupabaseClient(),
      queryClient,
      dateFields: ['invitedAt', 'acceptedAt', 'createdAt', 'updatedAt'],
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
// import { type OrgMembership } from '@credopass/lib/schemas';
// import { getAPIBaseURL, handleAPIErrors, authHeaders } from '../client';
//
// export function createOrgMembershipCollection(queryClient: QueryClient) {
//   return createCollection(
//     queryCollectionOptions({
//       queryKey: ['org-memberships'],
//       queryFn: async () => {
//         try {
//           const response = await fetch(`${getAPIBaseURL()}/org-memberships`, { headers: await authHeaders() });
//           const data = await response.json();
//           // Transform dates from the API response
//           return data.map((record: OrgMembership) => ({
//             ...record,
//             invitedAt: record.invitedAt ? new Date(record.invitedAt) : null,
//             acceptedAt: record.acceptedAt ? new Date(record.acceptedAt) : null,
//             createdAt: new Date(record.createdAt),
//             updatedAt: new Date(record.updatedAt),
//           }));
//         } catch (error) {
//           throw `An error occurred while fetching org memberships: ${String(error)}. Please ensure the API server is running and accessible.`;
//         }
//       },
//       schema: OrgMembershipSchema,
//       getKey: (item) => item.id,
//       queryClient,
//
//       // Handle INSERT
//       onInsert: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { modified: newRecord } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/org-memberships`, {
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
//         const response = await fetch(`${getAPIBaseURL()}/org-memberships/${original.id}`, {
//           method: 'PUT',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(modified),
//         });
//         if (!response.ok) throw new Error('Failed to update org membership');
//       },
//
//       // Handle DELETE
//       onDelete: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/org-memberships/${original.id}`, {
//           method: 'DELETE',
//           headers: await authHeaders(),
//         });
//         if (!response.ok) throw new Error('Failed to delete org membership');
//       },
//     })
//   );
// }
