// ============================================================================
// FILE: packages/api-client/src/collections/events.ts
// TanStack DB collection for Events
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { Event } from '@credopass/lib/schemas';
import { getAPIBaseURL, handleAPIErrors } from '../client';

const getStatus = (start: Date, status: Event['status']): Event['status'] => {
  if (status == 'cancelled' || status === 'draft') return status;
  const now = new Date();
  return (start < now) ? 'completed' : 'scheduled';
}

/**
 * Create event collection with a specific QueryClient
 */
export function createEventCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['events'],
      queryFn: async (): Promise<Event[]> => {
        try {
          const response = await fetch(`${getAPIBaseURL()}/events`);
          const data = await response.json() as Event[];
          // Transform dates from the API response
          return data.map((event) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
            createdAt: new Date(event.createdAt),
            updatedAt: new Date(event.updatedAt),
            status: getStatus(new Date(event.startTime), event.status)
          }));
        } catch (error) {
          throw `An error occurred while fetching events: ${String(error)}. Please ensure the API server is running and accessible.`;
        }

      },
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newEvent } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvent),
        });
        await handleAPIErrors(response);
        return response.json();
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/events/${original.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modified),
        });
        if (!response.ok) throw new Error('Failed to update event');
      },

      // Handle DELETE
      onDelete: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/events/${original.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete event');
      },
    })
  );
}

export type EventCollection = ReturnType<typeof createEventCollection>;
