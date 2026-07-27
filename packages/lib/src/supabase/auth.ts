// api-client — no env access, no client construction
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Where a password-recovery link lands. Supabase puts the recovery token in the
 * URL fragment; the route reads it to establish a short-lived session in which
 * `updatePassword` is allowed.
 */
const RESET_PATH = '/reset-password'

/**
 * Anonymous sign-in is deliberately absent.
 *
 * It used to be here, and the login screen auto-invoked it so nobody met a sign
 * -in wall. In practice it created an `accounts` row per browser profile, gave
 * the visitor a "create your organization" form instead of the app, and had no
 * upgrade path — so a guest who built something and cleared their storage lost
 * it permanently, with no owner left who could recover it. Removed rather than
 * patched. Do not reintroduce `signInAnonymously` without an account-linking
 * flow to go with it.
 */
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

    /**
     * Send a recovery link.
     *
     * Never reports whether the address is registered — the caller shows the
     * same confirmation either way. Answering differently turns this into an
     * oracle for "does this person have an account here", which for a church or
     * a support group is a real disclosure.
     */
    sendPasswordReset: (email: string) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${RESET_PATH}`,
      }),

    /** Set a new password, using the session a recovery link established. */
    updatePassword: (password: string) => supabase.auth.updateUser({ password }),
  }
}
