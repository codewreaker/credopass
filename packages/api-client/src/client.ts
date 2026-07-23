/**
 * API Client Configuration
 * Base client for data fetching across web and mobile
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// Default fallback
let API_BASE_URL = '/api/core';

// Returns the caller's current access token (or null when signed out).
// Wired up by the host app, e.g. from the shared Supabase client session.
let getAuthToken: (() => Promise<string | null>) | undefined;

// The shared Supabase browser client, injected by the host app. The TanStack DB
// collections now talk to Supabase (PostgREST + Realtime) directly through this
// client instead of going through the drizzle-backed REST API.
let supabaseClient: SupabaseClient | undefined;

/**
 * Configure the API client with environment-specific settings
 * Must be called before using getCollections()
 */
export function configureAPIClient(config: {
  baseURL: string;
  getAuthToken?: () => Promise<string | null>;
  // The host app's shared Supabase client. Required now that collections sync
  // directly against Supabase. (Still optional in the type so the legacy
  // drizzle/REST path keeps compiling.)
  supabase?: SupabaseClient;
}) {
  API_BASE_URL = config.baseURL;
  getAuthToken = config.getAuthToken;
  supabaseClient = config.supabase;
}

/**
 * Get the configured Supabase client used by the collections.
 * Throws if the host app never called `configureAPIClient({ supabase })`.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase client not configured. Call configureAPIClient({ supabase }) before using collections.'
    );
  }
  return supabaseClient;
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
