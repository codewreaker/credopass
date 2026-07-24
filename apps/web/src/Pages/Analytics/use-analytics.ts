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
 */
export function useAnalytics(scope: string, range: AnalyticsRange): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchAnalytics(scope, range, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setData(payload);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [scope, range]);

  return useMemo(() => ({ data, isLoading, error }), [data, isLoading, error]);
}
