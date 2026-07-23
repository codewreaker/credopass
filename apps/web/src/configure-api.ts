/**
 * Configures the shared API client as an import-time side effect.
 *
 * Several containers (EventForm, OrganizationForm, UserForm, …) call
 * `getCollections()` at module scope, which builds the Supabase-backed
 * collections immediately. Because ES modules evaluate imported modules before
 * the body of the importing module, that happens *before* any code in
 * `main.tsx` runs. Importing this module first — ahead of `routeTree.gen` —
 * guarantees the Supabase client is registered before the first collection is
 * created.
 */
import { configureAPIClient } from '@credopass/api-client'
import { getAccessToken, supabase } from './supabase'

// Collections now sync directly against Supabase via the shared browser client
// (PostgREST for reads/writes, Realtime when enabled). The baseURL/getAuthToken
// are retained for the legacy drizzle-backed REST path, which is no longer used.
configureAPIClient({
  baseURL: import.meta.env.VITE_API_URL || '/api/core',
  getAuthToken: getAccessToken,
  supabase,
})
