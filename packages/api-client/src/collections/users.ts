// ============================================================================
// FILE: packages/api-client/src/collections/users.ts
// TanStack DB collection for Users — synced directly against Supabase.
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { z } from 'zod';
import { UserSchema } from '@credopass/lib/schemas';
import { getSupabaseClient } from '../client';
import { supabaseCollectionOptionsWithDates } from './supabase-collection';

// Coerce ISO-string timestamps back into `Date` objects (see events.ts note).
const UserCollectionSchema = UserSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Create user collection with a specific QueryClient.
 * Talks to the Supabase `users` table directly via PostgREST.
 */
export function createUserCollection(queryClient: QueryClient) {
  return createCollection(
    supabaseCollectionOptionsWithDates({
      tableName: 'users',
      schema: UserCollectionSchema,
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
// import { type User } from '@credopass/lib/schemas';
// import { getAPIBaseURL, authHeaders } from '../client';
//
// export function createUserCollection(queryClient: QueryClient) {
//   return createCollection(
//     queryCollectionOptions({
//       queryKey: ['users'],
//       queryFn: async () => {
//         const response = await fetch(`${getAPIBaseURL()}/users`, { headers: await authHeaders() });
//         if (!response.ok) throw new Error('Failed to fetch users');
//         const data = await response.json() as User[];
//         return data.map((user) => ({
//           ...user,
//           createdAt: new Date(user.createdAt),
//           updatedAt: new Date(user.updatedAt),
//         }));
//       },
//       schema: UserSchema,
//       getKey: (item) => item.id,
//       queryClient,
//
//       // Handle INSERT
//       onInsert: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { modified: newUser } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/users`, {
//           method: 'POST',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(newUser),
//         });
//         if (!response.ok) throw new Error(`Failed to create loyalty record | HTTP ${response.status}: ${response.statusText}`);
//         return response.json();
//       },
//
//       // Handle UPDATE
//       onUpdate: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original, modified } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/users/${original.id}`, {
//           method: 'PUT',
//           headers: await authHeaders({ 'Content-Type': 'application/json' }),
//           body: JSON.stringify(modified),
//         });
//         if (!response.ok) throw new Error('Failed to update user');
//       },
//
//       // Handle DELETE
//       onDelete: async ({ transaction }) => {
//         const mutation = transaction.mutations[0];
//         if (!mutation) return;
//         const { original } = mutation;
//         const response = await fetch(`${getAPIBaseURL()}/users/${original.id}`, {
//           method: 'DELETE',
//           headers: await authHeaders(),
//         });
//         if (!response.ok) throw new Error('Failed to delete user');
//       },
//     })
//   );
// }
