import { createClient } from '@supabase/supabase-js'

// If you already have a shared Supabase client elsewhere in the monorepo
// (e.g. `@credopass/core/supabase`), delete this file and import that one
// instead in `-lib/auth.ts`. This is here so the folder is self-contained.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
