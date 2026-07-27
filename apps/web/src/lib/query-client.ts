/**
 * The single QueryClient.
 *
 * Retry policy is the interesting part. The API answers RFC 9457 problem+json
 * and `ApiError.status` carries the real code, so a 404 (another tenant's row,
 * or nothing there) and a 403 (your tenant, wrong role) are both final answers —
 * retrying them only delays the message the user is waiting for. Server errors
 * and network failures are worth one more go.
 */

import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@credopass/api-client';

const RETRYABLE_ATTEMPTS = 2;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status < 500) return false;
        return failureCount < RETRYABLE_ATTEMPTS;
      },
    },
    mutations: {
      // A write that failed on a 4xx failed for a reason the user must see —
      // `capacity_reached`, `email_taken`, `last_owner`. Never retry into it.
      retry: false,
    },
  },
});
