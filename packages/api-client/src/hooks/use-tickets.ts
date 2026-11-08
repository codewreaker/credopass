/**
 * The personal scope — `/me/tickets` and `/me/claim`.
 *
 * Everything else org-scoped in this package keys its cache under
 * `['org', organizationId, …]` so switching organisation produces a miss
 * rather than serving the previous tenant's rows. These hooks deliberately do
 * not: a ticket is the caller's regardless of which organisation ran the
 * event, and switching the active org must not empty the screen or refetch it.
 *
 * Nothing here sends `X-Organization-Id`, and the routes would ignore it.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../client';
import { queryKeys, ticketsScope } from '../query-keys';
import type { ClaimResult, TicketGroup, TicketsResponse } from '../types';
import { unwrap } from './internal';

/**
 * Events this account is attending — not hosting.
 *
 * Both counts arrive with either group, so the Upcoming ⇄ Past switch can
 * label the side you are not on without a second request. Rendering a `0` you
 * have not fetched is the most repeated defect in this product.
 */
export function useMyTickets(group: TicketGroup): UseQueryResult<TicketsResponse> {
  return useQuery({
    queryKey: queryKeys.tickets(group),
    queryFn: () => unwrap(api.GET('/me/tickets', { params: { query: { group } } })),
    staleTime: 30_000,
  });
}

/**
 * Mint a fresh pass for an event this account is attending.
 *
 * It **replaces** the previous pass: only a hash of the token is stored, so
 * there is no way to hand back the original, and one live pass per person per
 * event is a database constraint. Say so wherever this is called.
 */
export function useReissuePass(): UseMutationResult<
  { url: string; token: string; expiresAt: string },
  Error,
  string
> {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const result = await unwrap(
        api.POST('/me/tickets/{eventId}/pass', { params: { path: { eventId } } })
      );
      return result.pass;
    },
  });
}

/**
 * Link registrations made before this account existed.
 *
 * Matches only on an address the identity provider asserted, never one the
 * caller typed, and creates no membership — claiming a ticket is not joining
 * an organisation. Idempotent, so calling it on every sign-in is safe and
 * costs one indexed update that usually touches nothing.
 */
export function useClaimTickets(): UseMutationResult<ClaimResult, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/me/claim')),
    onSuccess: (result) => {
      // Only disturb the cache when something actually moved. The common case
      // is a returning user with nothing to claim, and invalidating on every
      // sign-in would refetch both halves of the list for no reason.
      if (result.claimed > 0) {
        queryClient.invalidateQueries({ queryKey: ticketsScope() });
      }
    },
  });
}
