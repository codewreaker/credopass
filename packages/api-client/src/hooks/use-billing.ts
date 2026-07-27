/**
 * Plans and plan changes.
 *
 * **No payment is taken.** `useChangePlan` calls an endpoint that writes a
 * column — billing is deferred (D15), and the checkout screen in front of this
 * is explicitly a mock. Do not send card details: the body is a plan id, and
 * that is all the API accepts.
 *
 * Only an owner holds `org:billing`, so gate the control on
 * `useCan('org:billing')` rather than letting it 403.
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
import type { Plan, PlanChange, PlanId } from '../types';
import { unwrap } from './internal';

/** The catalogue: names, prices and limits. Public — no session needed. */
export function usePlans(): UseQueryResult<Plan[]> {
  return useQuery({
    queryKey: queryKeys.plans(),
    queryFn: () => unwrap(api.GET('/plans')),
    // Pricing changes on the order of months, not minutes.
    staleTime: 60 * 60_000,
  });
}

/**
 * Move an organization onto a plan. Idempotent — re-submitting the plan you are
 * already on succeeds rather than conflicting.
 *
 * Invalidates `/me/context` as well as the org list: entitlements the app gates
 * on are read from context, so skipping it would leave the UI on the old plan
 * until a reload.
 */
export function useChangePlan(
  organizationId: string | undefined
): UseMutationResult<PlanChange, Error, PlanId> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan) =>
      unwrap(
        api.PUT('/organizations/{id}/plan', {
          params: { path: { id: organizationId! } },
          body: { plan },
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.organization(organizationId) });
      }
    },
  });
}
