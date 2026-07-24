import { useEffect, useMemo, useState } from 'react';
import { fetchAnalytics } from '@credopass/api-client';
import type { AnalyticsRange, AnalyticsResponse } from '@credopass/lib/analytics';

interface UseAnalyticsResult {
  data: AnalyticsResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch analytics for the current scope + range. Deliberately lightweight — a
 * fetch in an effect with abort, no extra data-layer dependency. The payload is
 * server-fabricated for now; this hook is unchanged when it becomes real.
 *
 * Loading is *derived* (`resultKey !== requestKey`) rather than set at the top
 * of the effect, so we never call setState synchronously during the effect —
 * the only updates happen after the fetch settles. The previous payload is kept
 * on the screen (dimmed) while the next one loads.
 */
export function useAnalytics(scope: string, range: AnalyticsRange): UseAnalyticsResult {
  const requestKey = `${scope}|${range}`;
  const [result, setResult] = useState<{
    key: string;
    data: AnalyticsResponse | null;
    error: string | null;
  }>({ key: '', data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    fetchAnalytics(scope, range, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data: payload, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
        setResult({
          key: requestKey,
          data: null,
          error: err instanceof Error ? err.message : 'Failed to load analytics',
        });
      });

    return () => controller.abort();
  }, [scope, range, requestKey]);

  return useMemo(
    () => ({
      data: result.data,
      // A settled result for the current query means we're no longer loading.
      isLoading: result.key !== requestKey,
      error: result.key === requestKey ? result.error : null,
    }),
    [result, requestKey]
  );
}
