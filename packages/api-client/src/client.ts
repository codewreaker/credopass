/**
 * API Client Configuration
 * Base client for data fetching across web and mobile
 */

// Default fallback
let API_BASE_URL = '/api/core';

// Returns the caller's current access token (or null when signed out).
// Wired up by the host app, e.g. from the shared Supabase client session.
let getAuthToken: (() => Promise<string | null>) | undefined;

/**
 * Configure the API client with environment-specific settings
 * Must be called before using getCollections()
 */
export function configureAPIClient(config: {
  baseURL: string;
  getAuthToken?: () => Promise<string | null>;
}) {
  API_BASE_URL = config.baseURL;
  getAuthToken = config.getAuthToken;
}

/**
 * Get the current API base URL
 */
export function getAPIBaseURL(): string {
  return API_BASE_URL;
}

/**
 * Headers for API requests: merges the configured auth token (the API
 * rejects unauthenticated requests) with any extra headers.
 */
export async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const token = getAuthToken ? await getAuthToken() : null;
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function handleAPIErrors(response: Response) {
  if (!response.ok) {
    const { error: { cause } } = (await response.json()) as any;
    console.error('======API Error======');
    console.error(cause?.stack);
    console.error('======API Error======');
    throw new Error(`${cause?.detail}`);
  }
}
