// ============================================================================
// FILE: packages/api-client/src/endpoints/events.ts
// Event API endpoints
// ============================================================================

import type { ApiClient } from '../client';
import type { Event, CreateEvent, UpdateEvent, EventStatus } from '@dwellpass/validation';

export function createEventsApi(client: ApiClient) {
  return {
    /**
     * Get all events, optionally filtered by status or hostId
     */
    getAll: (params?: { status?: EventStatus; hostId?: string }) =>
      client.get<Event[]>('/api/events', params as Record<string, string>),

    /**
     * Get an event by ID
     */
    getById: (id: string) => client.get<Event>(`/api/events/${id}`),

    /**
     * Create a new event
     */
    create: (data: CreateEvent) => client.post<Event, CreateEvent>('/api/events', data),

    /**
     * Update an event
     */
    update: (id: string, data: UpdateEvent) =>
      client.put<Event, UpdateEvent>(`/api/events/${id}`, data),

    /**
     * Delete an event
     */
    delete: (id: string) => client.delete(`/api/events/${id}`),

    /**
     * Get upcoming events
     */
    getUpcoming: () => client.get<Event[]>('/api/events/upcoming'),

    /**
     * Get events by date range
     */
    getByDateRange: (start: Date, end: Date) =>
      client.get<Event[]>('/api/events', {
        start: start.toISOString(),
        end: end.toISOString(),
      }),
  };
}

export type EventsApi = ReturnType<typeof createEventsApi>;
