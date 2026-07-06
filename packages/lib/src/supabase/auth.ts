// api-client — no env access, no client construction
import type { SupabaseClient } from '@supabase/supabase-js'

export function createAuthClient(supabase: SupabaseClient) {
  return {
    signInWithEmail: (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),

    signUpWithEmail: (email: string, password: string) =>
      supabase.auth.signUp({ email, password }),

    signInWithGithub: () =>
      supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/events` },
      }),

    signInAsGuest: () => supabase.auth.signInAnonymously(),
  }
}