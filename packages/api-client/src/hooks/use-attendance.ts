/**
 * Attendance — register, check in, check out, and the kiosk's live counter.
 *
 * These are the routes a paired device can call as well as a signed-in user, so
 * nothing here assumes an account session: the credential is whatever
 * `configureAPIClient({ getAuthToken })` hands over, a Supabase JWT or a `cpd_…`
 * device token.
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
  AttendanceResult,
  CheckInBody,
  CheckInState,
  CheckOutBody,
  RegisterBody,
  RegisterResult,
} from '../types';
import { unwrap } from './internal';

/**
 * The kiosk counter.
 *
 * Polled, not pushed: `GET /events/{id}/stream` is Phase 4 and does not exist
 * yet (§1.6). Five seconds is the interval the plan specifies — long enough not
 * to hammer the API from a room full of tablets, short enough that two doors
 * agree on the count.
 */
export function useCheckInState(
  eventId: string | undefined,
  options?: { pollMs?: number; enabled?: boolean }
): UseQueryResult<CheckInState> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.checkinState(organizationId, eventId ?? ''),
    queryFn: () =>
      unwrap(api.GET('/events/{id}/checkin-state', { params: { path: { id: eventId! } } })),
    enabled: !!eventId && (options?.enabled ?? true),
    refetchInterval: options?.pollMs ?? 5_000,
    // A door tablet is often left on a table; keep counting while it is.
    refetchIntervalInBackground: true,
  });
}

/** Invalidate everything a check-in moves: the counter, the list, the standings. */
function useInvalidateAttendance(eventId: string) {
  const queryClient = useQueryClient();
  const organizationId = useActiveOrganizationId();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.checkinState(organizationId, eventId) });
    queryClient.invalidateQueries({ queryKey: eventsScope(organizationId) });
    queryClient.invalidateQueries({ queryKey: peopleScope(organizationId) });
  };
}

/**
 * Register someone onto an event. Returns a **pass URL**.
 *
 * No email is sent — `NotificationService` does not exist yet — so the caller
 * must put `pass.url` on screen. Do not write "check your email" (§1.6).
 */
export function useRegisterAttendee(
  eventId: string
): UseMutationResult<RegisterResult, Error, RegisterBody> {
  const invalidate = useInvalidateAttendance(eventId);
  return useMutation({
    mutationFn: (body) =>
      unwrap(api.POST('/events/{id}/register', { params: { path: { id: eventId } }, body })),
    onSuccess: invalidate,
  });
}

/**
 * The kiosk's one endpoint. Idempotent — a second scan of the same pass returns
 * `alreadyRecorded: true` rather than failing, which is what lets a door queue
 * move without the operator having to remember who they already scanned.
 */
export function useCheckIn(
  eventId: string
): UseMutationResult<AttendanceResult, Error, CheckInBody> {
  const invalidate = useInvalidateAttendance(eventId);
  return useMutation({
    mutationFn: (body) =>
      unwrap(api.POST('/events/{id}/check-in', { params: { path: { id: eventId } }, body })),
    onSuccess: invalidate,
  });
}

/** Only reachable when the event sets `requireCheckOut`. */
export function useCheckOut(
  eventId: string
): UseMutationResult<AttendanceResult, Error, CheckOutBody> {
  const invalidate = useInvalidateAttendance(eventId);
  return useMutation({
    mutationFn: (body) =>
      unwrap(api.POST('/events/{id}/check-out', { params: { path: { id: eventId } }, body })),
    onSuccess: invalidate,
  });
}
