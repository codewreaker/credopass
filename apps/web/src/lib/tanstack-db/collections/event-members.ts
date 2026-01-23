// ============================================================================
// FILE: packages/tanstack-db/src/collections/event-members.ts
// TanStack DB collection for Event Members
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { EventMember } from '@credopass/lib/schemas';
import { API_BASE_URL } from '../../../config';
import { handleAPIErrors } from '..';

/**
 * Create event members collection with a specific QueryClient
 */
export function createEventMemberCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['event-members'],
      queryFn: async (): Promise<EventMember[]> => {
        try {
          const response = await fetch(`${API_BASE_URL}/event-members`);
          const data = await response.json();
          // Transform dates from the API response
          return data.map((record: EventMember) => ({
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          }));
        } catch (error) {
          throw `An error occurred while fetching event members: ${String(error)}. Please ensure the API server is running and accessible.`;
        }
      },
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newRecord } = mutation;
        const response = await fetch(`${API_BASE_URL}/event-members`, {
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
        const response = await fetch(`${API_BASE_URL}/event-members/${original.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modified),
        });
        if (!response.ok) throw new Error('Failed to update event member');
      },

      // Handle DELETE
      onDelete: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original } = mutation;
        const response = await fetch(`${API_BASE_URL}/event-members/${original.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete event member');
      },
    })
  );
}

export type EventMemberCollection = ReturnType<typeof createEventMemberCollection>;
