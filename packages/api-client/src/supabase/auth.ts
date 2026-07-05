import { supabase } from './client'

export function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export function signInWithGithub() {
  // Supabase handles the redirect to GitHub and back — this call itself
  // does not resolve with a session, it just kicks off the redirect.
  return supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  })
}

export function signInAsGuest() {
  // Requires "Allow anonymous sign-ins" to be enabled in
  // Supabase → Authentication → Settings.
  return supabase.auth.signInAnonymously()
}
