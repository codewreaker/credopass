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

/**
 * Turn a failed response into an `Error` with a message worth showing a user.
 *
 * The API answers with several shapes — `{ error: 'Validation failed', details }`
 * (400), `{ error: { message, detail } }` (500), `{ message }` (Hono
 * HTTPException), or plain text — so probe them in order and always fall back to
 * the HTTP status. Reading one specific shape is what surfaced a literal
 * "undefined" in the toast whenever the server sent any of the others.
 */
export async function handleAPIErrors(response: Response) {
  if (response.ok) return;

  const raw = await response.text();
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    body = undefined;
  }

  const { error } = body ?? {};
  const zodIssues = Array.isArray(body?.details)
    ? body.details
        .map((issue: any) => `${issue.path?.join('.') || 'value'}: ${issue.message}`)
        .join('; ')
    : undefined;

  const message =
    // Postgres / driver errors serialise their useful text under these keys
    error?.cause?.detail ??
    error?.detail ??
    error?.message ??
    (typeof error === 'string' ? error : undefined) ??
    body?.message ??
    (raw.trim() && !body ? raw.trim() : undefined) ??
    `Request failed (HTTP ${response.status})`;

  console.error('======API Error======');
  console.error(`${response.status} ${response.url}`, body ?? raw);
  console.error('======API Error======');

  throw new Error(zodIssues ? `${message} — ${zodIssues}` : message);
}

import type { AnalyticsRange, AnalyticsResponse } from '@credopass/lib/analytics';

/**
 * Fetch analytics for a scope (`all` or an event id) and range. The numbers are
 * fabricated server-side for now; this call is the seam that becomes real when
 * the analytics generator is swapped for aggregates.
 */
export async function fetchAnalytics(
  scope: string,
  range: AnalyticsRange,
  signal?: AbortSignal
): Promise<AnalyticsResponse> {
  const params = new URLSearchParams({ scope, range });
  const response = await fetch(`${getAPIBaseURL()}/analytics?${params.toString()}`, {
    headers: await authHeaders(),
    signal,
  });
  if (!response.ok) throw new Error(`Failed to fetch analytics (HTTP ${response.status})`);
  return response.json() as Promise<AnalyticsResponse>;
}
