/**
 * The attendee surface — the shared link and the pass.
 *
 * Bearer scope, or no credential at all. Someone opened a URL from a message;
 * they have no account, belong to no organization, and must never be shown a
 * sign-in prompt to read a pass they already hold.
 *
 * `X-Organization-Id` is harmless on these routes (they ignore it), so no
 * special client configuration is needed — but nothing here may consult the
 * active organization either, because on `/p/{token}` there isn't one.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../client';
import { queryKeys } from '../query-keys';
import type {
  ApiBody,
  PassView,
  PublicCheckInResult,
  PublicEvent,
  PublicRegisterResult,
} from '../types';
import { unwrap } from './internal';

/** The shared link. A cancelled event still resolves — it does not 404. */
export function usePublicEvent(id: string | undefined): UseQueryResult<PublicEvent> {
  return useQuery({
    queryKey: queryKeys.publicEvent(id ?? ''),
    queryFn: () => unwrap(api.GET('/public/events/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    retry: false,
  });
}

/**
 * Register from the public page. `pass.url` comes back synchronously and is the
 * only copy the attendee gets — show it, and say so.
 */
export function usePublicRegister(
  eventId: string
): UseMutationResult<
  PublicRegisterResult,
  Error,
  ApiBody<'/public/events/{id}/register', 'post'>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      unwrap(api.POST('/public/events/{id}/register', { params: { path: { id: eventId } }, body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.publicEvent(eventId) }),
  });
}

/** Walk-up self check-in. `403 self_checkin_disabled` when the organiser said no. */
export function usePublicCheckIn(
  eventId: string
): UseMutationResult<
  PublicCheckInResult,
  Error,
  ApiBody<'/public/events/{id}/check-in', 'post'>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      unwrap(api.POST('/public/events/{id}/check-in', { params: { path: { id: eventId } }, body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.publicEvent(eventId) }),
  });
}

/**
 * "Didn't get it?" — always 202, whether or not that address is registered.
 * The uniform answer is deliberate: a different response for a known address
 * would turn this into an attendee-list oracle.
 */
export function useResendPass(
  eventId: string
): UseMutationResult<{ accepted: true }, Error, string> {
  return useMutation({
    mutationFn: (email) =>
      unwrap(
        api.POST('/public/events/{id}/resend-pass', {
          params: { path: { id: eventId } },
          body: { email },
        })
      ),
  });
}

/**
 * The pass itself. Returns a first name and a last **initial** — never the
 * email. `410` and `404` are both calm states, not errors to retry.
 */
export function usePass(token: string | undefined): UseQueryResult<PassView> {
  return useQuery({
    queryKey: queryKeys.pass(token ?? ''),
    queryFn: () => unwrap(api.GET('/p/{token}', { params: { path: { token: token! } } })),
    enabled: !!token,
    retry: false,
  });
}

export function usePassCheckIn(
  token: string
): UseMutationResult<PublicCheckInResult, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/p/{token}/check-in', { params: { path: { token } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pass(token) }),
  });
}
