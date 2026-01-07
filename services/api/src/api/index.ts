// ============================================================================
// FILE: packages/api-client/src/index.ts
// Main entry point for @dwellpass/api-client package
// ============================================================================

import { createApiClient, type ApiClientConfig } from './client';
import { createUsersApi } from './endpoints/users';
import { createEventsApi } from './endpoints/events';
import { createAttendanceApi } from './endpoints/attendance';
import { createLoyaltyApi } from './endpoints/loyalty';

export { ApiError, type ApiClient, type ApiClientConfig } from './client';
export * from './endpoints';

/**
 * Create a fully-typed DwellPass API client
 */
export function createDwellPassClient(config: ApiClientConfig) {
  const client = createApiClient(config);

  return {
    users: createUsersApi(client),
    events: createEventsApi(client),
    attendance: createAttendanceApi(client),
    loyalty: createLoyaltyApi(client),
    
    // Expose raw client for custom requests
    raw: client,
  };
}

export type DwellPassClient = ReturnType<typeof createDwellPassClient>;

// Default client for browser environments
let defaultClient: DwellPassClient | null = null;

/**
 * Get or create the default API client
 * Uses VITE_API_URL environment variable or defaults to /api
 */
export function getApiClient(): DwellPassClient {
  if (!defaultClient) {
    const baseUrl = typeof import.meta !== 'undefined' && 'env' in import.meta
      ? (import.meta as any).env?.VITE_API_URL || ''
      : '';
    
    defaultClient = createDwellPassClient({ baseUrl });
  }
  return defaultClient;
}
