/**
 * Analytics.
 *
 * **The figures are fabricated today.** `data.fabricated` says so, and the
 * dashboard must label them from that flag rather than from a hard-coded
 * banner — the flag flips server-side when real aggregates land, and every
 * client should follow without a release.
 *
 * `scope` is either `'all'` or a single event id. Asking for an event in another
 * organization is a 404, like everywhere else.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../client';
import { queryKeys } from '../query-keys';
import { useActiveOrganizationId } from '../active-organization';
import type { Analytics, AnalyticsRange } from '../types';
import { unwrap } from './internal';

export function useAnalytics(
  scope: string = 'all',
  range: AnalyticsRange = 'month',
  options?: { enabled?: boolean }
): UseQueryResult<Analytics> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.analytics(organizationId, scope, range),
    queryFn: () =>
      unwrap(api.GET('/analytics/overview', { params: { query: { scope, range } } })),
    enabled: (options?.enabled ?? true) && !!organizationId,
    // Deterministic for a given scope+range, so re-fetching on every focus buys
    // nothing but a network round trip and a flash of the loading state.
    staleTime: 5 * 60_000,
    // Keeps the previous dashboard on screen while a new range loads, so
    // switching Week→Month dims rather than collapsing to skeletons.
    placeholderData: (previous) => previous,
  });
}
