// ============================================================================
// FILE: packages/api-client/src/collections/users.ts
// TanStack DB collection for Users
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { UserSchema, type User } from '@credopass/lib/schemas';
import { getAPIBaseURL, authHeaders } from '../client';
import { rememberPersistedId } from './persisted-ids';

/**
 * Create user collection with a specific QueryClient
 */
export function createUserCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['users'],
      queryFn: async () => {
        const response = await fetch(`${getAPIBaseURL()}/users`, { headers: await authHeaders() });
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json() as User[];
        return data.map((user) => ({
          ...user,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        }));
      },
      schema: UserSchema,
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newUser } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/users`, {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(newUser),
        });
        if (!response.ok) throw new Error(`Failed to create user | HTTP ${response.status}: ${response.statusText}`);
        const created = await response.json();
        // The server assigns its own id — record it so callers can link the new
        // user to an event without writing a foreign key that points nowhere.
        rememberPersistedId('users', newUser.id, created?.id);
        return created;
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/users/${original.id}`, {
          method: 'PUT',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
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
          headers: await authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete user');
      },
    })
  );
}