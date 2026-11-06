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

/** A sign-in failure, in the shape the error screen renders. */
export interface AuthProblem {
  /** What the person is told. Never the raw provider message. */
  title: string
  detail: string
  /** GoTrue's machine code, e.g. `validation_failed`, `access_denied`. */
  code?: string
  status?: number
  provider: string
  /** Verbatim response body or redirect params, for the details disclosure. */
  raw?: string
}

const GENERIC: Omit<AuthProblem, 'provider'> = {
  title: 'We could not start sign-in',
  detail:
    'Google sign-in is not responding as expected. This is on our side, not yours — nothing was' +
    ' submitted and no account was changed.',
}

/**
 * Ask the authorize endpoint whether it will actually serve this provider,
 * BEFORE handing the browser over to it.
 *
 * Without this the browser navigates to Supabase, Supabase answers
 * `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider:
 * provider is not enabled"}` as raw JSON on ITS OWN domain, and the person is
 * stranded on a white page of JSON with no way back. That page cannot be styled
 * or intercepted from here — it is not our origin — so the only way to keep the
 * failure inside the app is to find out before leaving it.
 *
 * `redirect: 'manual'` makes a working provider answer an opaque redirect
 * (`type: 'opaqueredirect'`, `status: 0`), which we treat as "go ahead". Only a
 * readable 4xx/5xx stops the flow. The endpoint sends permissive CORS headers,
 * so the error body is readable cross-origin — verified against a live project.
 *
 * **A failed pre-flight never blocks sign-in.** A thrown fetch, a timeout, an
 * opaque response: all fall through to the redirect. This check exists to turn
 * one known failure into a decent screen, not to become a new way to not sign in.
 */
async function preflight(url: string, provider: string): Promise<AuthProblem | null> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 5000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: abort.signal,
    })

    if (response.status === 0 || response.type === 'opaqueredirect' || response.ok) return null
    if (response.status < 400) return null

    const raw = await response.text().catch(() => '')
    let message: string | undefined
    let code: string | undefined
    try {
      const body = JSON.parse(raw) as { msg?: string; message?: string; error_code?: string }
      message = body.msg ?? body.message
      code = body.error_code
    } catch {
      /* not JSON — `raw` still goes to the details panel */
    }

    const notEnabled = code === 'validation_failed' && /provider is not enabled/i.test(message ?? '')

    return {
      title: notEnabled ? 'Google sign-in is not switched on yet' : GENERIC.title,
      detail: notEnabled
        ? 'This CredoPass instance has not finished setting up Google as a sign-in provider.' +
          ' Nothing is wrong with your Google account.'
        : GENERIC.detail,
      code,
      status: response.status,
      provider,
      raw: raw || undefined,
    }
  } catch {
    // Offline, blocked, timed out — not evidence the provider is broken.
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function createAuthClient(supabase: SupabaseClient) {
  return {
    /**
     * @param redirectTo A same-origin PATH to land on afterwards, e.g. the
     * private route a guard bounced the visitor away from. Anything that is not
     * a relative path is ignored rather than honoured — an absolute URL here
     * would be an open redirect, and the value reaches us from the query string.
     *
     * Resolves with `{ error }` ONLY when sign-in did not start. On success the
     * browser has already left for Google and nothing downstream runs.
     */
    signInWithGoogle: async (redirectTo = '/events'): Promise<{ error: AuthProblem | null }> => {
      const safe =
        redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/events'

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${safe}`,
          // Build the URL but do not follow it yet — pre-flight comes first.
          skipBrowserRedirect: true,
        },
      })

      if (error || !data?.url) {
        return {
          error: {
            ...GENERIC,
            provider: 'google',
            raw: error ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : undefined,
          },
        }
      }

      const problem = await preflight(data.url, 'google')
      if (problem) return { error: problem }

      window.location.assign(data.url)
      return { error: null }
    },
  }
}

/**
 * Read a sign-in failure out of the URL on the way BACK from the provider.
 *
 * GoTrue's `redirectErrors` puts `error`, `error_description` and `error_code`
 * into both the query string (PKCE) and the fragment (implicit), with an `sb`
 * marker. Before this existed, a visitor who declined consent at Google landed
 * on `/events` with no session and no explanation at all.
 *
 * Returns null when the URL carries no such error, which is the normal case.
 */
export function readAuthErrorFromUrl(url: string = window.location.href): AuthProblem | null {
  let parsed: URL
  try {
    // A base, so a router-supplied path+search+hash parses as readily as a full
    // href. The base's origin is never read.
    parsed = new URL(url, 'http://local')
  } catch {
    return null
  }

  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const pick = (key: string) => parsed.searchParams.get(key) ?? fragment.get(key)

  const error = pick('error')
  const description = pick('error_description')
  if (!error && !description) return null

  const code = pick('error_code') ?? undefined
  const denied = error === 'access_denied'

  return {
    title: denied ? 'Sign-in was cancelled' : 'Google could not sign you in',
    detail: denied
      ? 'You did not finish granting access at Google, so no session was created. You can try again.'
      : GENERIC.detail,
    code: code ?? error ?? undefined,
    provider: 'google',
    raw: JSON.stringify(
      { error, error_code: code, error_description: description },
      null,
      2
    ),
  }
}
