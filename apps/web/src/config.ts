/**
 * API Configuration
 * Automatically switches between development and production based on environment
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/core';

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


// If you already have a shared Supabase client elsewhere in the monorepo
// (e.g. `@credopass/core/supabase`), delete this file and import that one
// instead in `-lib/auth.ts`. This is here so the folder is self-contained.

if (!SUPASE_CRED.ANON_KEY || !SUPASE_CRED.URL) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
  )
}