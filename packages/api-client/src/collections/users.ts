// ============================================================================
// FILE: packages/api-client/src/collections/users.ts
// TanStack DB collection for Users
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { User } from '@credopass/lib/schemas';
import { getAPIBaseURL } from '../client';

/**
 * Create user collection with a specific QueryClient
 */
export function createUserCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['users'],
      queryFn: async (): Promise<User[]> => {
        const response = await fetch(`${getAPIBaseURL()}/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        return data.map((user: User) => ({
          ...user,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        }));
      },
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newUser } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser),
        });
        if (!response.ok) throw new Error(`Failed to create loyalty record | HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/users/${original.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modified),
        });
        if (!response.ok) throw new Error('Failed to update user');
      },

      // Handle DELETE
      onDelete: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/users/${original.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete user');
      },
    })
  );
}

export type UserCollection = ReturnType<typeof createUserCollection>;
