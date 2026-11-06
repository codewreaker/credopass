// api-client — no env access, no client construction
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Google is the only way in.
 *
 * Email+password and GitHub were both removed. One provider, chosen
 * deliberately:
 *
 *   · Nothing in this app stores or checks a password, so there is no reset
 *     flow, no strength meter, no recovery-link route and no credential to
 *     leak. The surface that is not there cannot be got wrong.
 *   · Google asserts the address itself. The app never has to decide whether an
 *     address is verified from a claim the user can write — which is the trap
 *     `user_metadata.email_verified` sets, and the reason account LINKING must
 *     never key on an unverified address.
 *
 * The provider's callback — https://<project>.supabase.co/auth/v1/callback —
 * is configured in the Google Cloud console and the Supabase dashboard, NOT
 * here. Supabase handles that leg; `redirectTo` below is only where Supabase
 * sends the browser once it already has a session.
 *
 * Anonymous sign-in is deliberately absent too. It used to be here, and the
 * login screen auto-invoked it so nobody met a sign-in wall. In practice it
 * created an `accounts` row per browser profile, gave the visitor a "create
 * your organization" form instead of the app, and had no upgrade path — so a
 * guest who built something and cleared their storage lost it permanently, with
 * no owner left who could recover it. Removed rather than patched. Do not
 * reintroduce `signInAnonymously` without an account-linking flow to go with it.
 */
export function createAuthClient(supabase: SupabaseClient) {
  return {
    /**
     * @param redirectTo A same-origin PATH to land on afterwards, e.g. the
     * private route a guard bounced the visitor away from. Anything that is not
     * a relative path is ignored rather than honoured — an absolute URL here
     * would be an open redirect, and the value reaches us from the query string.
     */
    signInWithGoogle: (redirectTo = '/events') => {
      const safe =
        redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/events'

      return supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${safe}` },
      })
    },
  }
}
