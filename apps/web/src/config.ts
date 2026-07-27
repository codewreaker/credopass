/**
 * Environment-derived configuration.
 *
 * There was an `API_BASE_URL` here defaulting to `/api/core` — a base path the
 * service stopped serving, and which nothing imported: the real one is set once
 * in `main.tsx` via `configureAPIClient`. A second, wrong copy of the API base
 * URL is exactly the kind of thing that gets picked up by mistake later.
 */

/**
 * Mapbox Configuration
 */
export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

if (!MAPBOX_ACCESS_TOKEN) {
  console.warn(
    'Mapbox access token is not configured. Please set VITE_MAPBOX_ACCESS_TOKEN in your environment variables.'
  );
}

export const SUPASE_CRED = {
  URL: import.meta.env.VITE_SUPABASE_URL,
  ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
}

if (!SUPASE_CRED.ANON_KEY || !SUPASE_CRED.URL) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
  )
}