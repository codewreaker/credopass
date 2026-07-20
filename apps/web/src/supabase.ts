/**
 * The single shared Supabase client for apps/web.
 * Import this instead of constructing new clients in components.
 */
import { createClient, createAuthClient } from '@credopass/lib/supabase'
import { SUPASE_CRED } from './config'

export const supabase = createClient(SUPASE_CRED.URL, SUPASE_CRED.ANON_KEY)

export const {
  signInAsGuest,
  signInWithEmail,
  signInWithGithub,
  signUpWithEmail,
} = createAuthClient(supabase)

/** Current session access token, for authenticated API requests. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
