// ============================================================================
// FILE: packages/api-client/src/collections/events.ts
// TanStack DB collection for Events
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { EventSchema, type Event } from '@credopass/lib/schemas';
import { getAPIBaseURL, handleAPIErrors, authHeaders } from '../client';
import { rememberPersistedId } from './persisted-ids';

/**
 * Derive the live status from the event's window.
 *
 * Statuses the organiser owns outright (draft, cancelled, and an explicit
 * completed) are passed through untouched. Everything else is derived, because
 * the API stores whatever status the event was created with and never ages it.
 *
 * The window matters: comparing only `startTime` against now marked an event
 * `completed` the instant it began, which is why an event created with the
 * default "starts now" flipped to completed on the very next fetch.
 */
const getStatus = (start: Date, end: Date | null, status: Event['status']): Event['status'] => {
  if (status === 'cancelled' || status === 'draft' || status === 'completed') return status;

  const now = Date.now();
  const startedAt = start?.getTime?.();
  if (!Number.isFinite(startedAt)) return status;

  if (now < startedAt) return 'scheduled';

  // No end time means we can't tell "running" from "over" — treat the event as
  // ongoing for its default hour rather than instantly completing it.
  const endedAt = end?.getTime?.();
  const finishedAt = Number.isFinite(endedAt) ? (endedAt as number) : startedAt + 60 * 60 * 1000;

  return now <= finishedAt ? 'ongoing' : 'completed';
};


/**
 * Create event collection with a specific QueryClient
 */
export function createEventCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['events'],
      queryFn: async () => {
        try {
          const response = await fetch(`${getAPIBaseURL()}/events`, { headers: await authHeaders() });
          const data = await response.json();
          // Transform dates from the API response
          return data.map((event: Event) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
            createdAt: new Date(event.createdAt),
            updatedAt: new Date(event.updatedAt),
            status: getStatus(
              new Date(event.startTime),
              event.endTime ? new Date(event.endTime) : null,
              event.status
            )
          }));
        } catch (error) {
          throw `An error occurred while fetching events: ${String(error)}. Please ensure the API server is running and accessible.`;
        }

      },
      schema: EventSchema,
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newEvent } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/events`, {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(newEvent),
        });
        await handleAPIErrors(response);
        const created = await response.json();
        rememberPersistedId('events', newEvent.id, created?.id);
        return created;
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${getAPIBaseURL()}/events/${original.id}`, {
          method: 'PUT',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
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
          headers: await authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete event');
      },
    })
  );
}

export type EventCollection = ReturnType<typeof createEventCollection>;
