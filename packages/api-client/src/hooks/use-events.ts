/**
 * Events.
 *
 * Status, counts and the organization name arrive already computed. Nothing here
 * derives them, and neither should any consumer: `deriveStatus` runs server-side
 * from the timestamps, so a client-side copy would drift the moment an event was
 * cancelled or closed (§2.3).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../client';
import { eventsScope, peopleScope, queryKeys } from '../query-keys';
import { useActiveOrganizationId } from '../active-organization';
import type {
  Event,
  EventCalendar,
  EventCreate,
  EventList,
  EventListQuery,
  EventUpdate,
  EventsSummary,
} from '../types';
import { compact, unwrap } from './internal';

/**
 * One page of events.
 *
 * Pagination is cursor-based — `{ data, page: { nextCursor, hasMore } }`. There
 * are no totals here on purpose; counts come from `/events/summary`.
 */
export function useEvents(
  query: EventListQuery = {},
  options?: { enabled?: boolean }
): UseQueryResult<EventList> {
  const organizationId = useActiveOrganizationId();
  const params = compact(query);

  return useQuery({
    queryKey: queryKeys.events(organizationId, params),
    queryFn: () => unwrap(api.GET('/events', { params: { query: params } })),
    enabled: (options?.enabled ?? true) && !!organizationId,
  });
}

/** The hero tiles and "up next" card. */
export function useEventsSummary(options?: { enabled?: boolean }): UseQueryResult<EventsSummary> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.eventsSummary(organizationId),
    queryFn: () => unwrap(api.GET('/events/summary')),
    enabled: (options?.enabled ?? true) && !!organizationId,
  });
}

/** The calendar rail. `month` is `YYYY-MM`. */
export function useEventsCalendar(
  month: string,
  options?: { enabled?: boolean }
): UseQueryResult<EventCalendar> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.eventsCalendar(organizationId, month),
    queryFn: () => unwrap(api.GET('/events/calendar', { params: { query: { month } } })),
    enabled: (options?.enabled ?? true) && !!organizationId,
  });
}

export function useEvent(id: string | undefined): UseQueryResult<Event> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.event(organizationId, id ?? ''),
    queryFn: () => unwrap(api.GET('/events/{id}', { params: { path: { id: id! } } })),
    enabled: !!id && !!organizationId,
    // Another tenant's event is a 404 by design, and retrying a 404 only delays
    // the "not found" the user is waiting for.
    retry: false,
  });
}

/**
 * Invalidate every event-derived cache entry.
 *
 * A write to one event moves the list, the summary tiles and the calendar too,
 * so they are invalidated as one scope rather than picked off individually.
 */
function useInvalidateEvents() {
  const queryClient = useQueryClient();
  const organizationId = useActiveOrganizationId();
  return () => queryClient.invalidateQueries({ queryKey: eventsScope(organizationId) });
}

export function useCreateEvent(): UseMutationResult<Event, Error, EventCreate> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (body) => unwrap(api.POST('/events', { body })),
    onSuccess: invalidate,
  });
}

/** Moving `startAt` preserves the duration — the server does that, not the form. */
export function useUpdateEvent(
  id: string
): UseMutationResult<Event, Error, EventUpdate> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (body) => unwrap(api.PATCH('/events/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/**
 * Cancel — idempotent, and the right answer for an event people have registered
 * for. The rows, the URL and the history all survive; `DELETE` does not offer
 * that and refuses (409) once anyone has signed up.
 */
export function useCancelEvent(): UseMutationResult<
  Event,
  Error,
  { id: string; reason?: string }
> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: ({ id, reason }) =>
      unwrap(api.POST('/events/{id}/cancel', { params: { path: { id } }, body: { reason } })),
    onSuccess: invalidate,
  });
}

/** Soft delete. **409 once anyone has registered** — offer cancel instead. */
export function useDeleteEvent(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async (id) => {
      await api.DELETE('/events/{id}', { params: { path: { id } } });
    },
    onSuccess: invalidate,
  });
}

/** Ends the event and finalises no-shows, which also moves every standing. */
export function useCloseEvent(): UseMutationResult<
  { closedAt: string; noShows: number },
  Error,
  string
> {
  const queryClient = useQueryClient();
  const organizationId = useActiveOrganizationId();

  return useMutation({
    mutationFn: (id) => unwrap(api.POST('/events/{id}/close', { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsScope(organizationId) });
      queryClient.invalidateQueries({ queryKey: peopleScope(organizationId) });
    },
  });
}
