// ============================================================================
// FILE: packages/api-client/src/index.ts
// Main entry point for @credopass/api-client package
// ============================================================================

import { createApiClient, type ApiClientConfig } from './client';
import { createUsersApi } from './endpoints/users';
import { createEventsApi } from './endpoints/events';
import { createAttendanceApi } from './endpoints/attendance';
import { createLoyaltyApi } from './endpoints/loyalty';

export { ApiError, type ApiClient, type ApiClientConfig } from './client';
export * from './endpoints';

/**
 * Create a fully-typed CredoPass API client
 */
export function createCredoPassClient(config: ApiClientConfig) {
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

export type CredoPassClient = ReturnType<typeof createCredoPassClient>;

// Default client for browser environments
let defaultClient: CredoPassClient | null = null;

/**
 * Get or create the default API client
 * Uses VITE_API_URL environment variable or defaults to /api
 */
export function getApiClient(): CredoPassClient {
  if (!defaultClient) {
    const baseUrl = typeof import.meta !== 'undefined' && 'env' in import.meta
      ? (import.meta as any).env?.VITE_API_URL || ''
      : '';
    
    defaultClient = createCredoPassClient({ baseUrl });
  }
  return defaultClient;
}
