/**
 * Where the PRODUCT lives — not where the API lives.
 *
 * WHAT WAS WRONG (NEXT-UI-LIST U5). Pass URLs were built from
 * `new URL(c.req.url).origin` — the origin of the incoming *API* request. Two
 * things go wrong at once, and both only in deployment:
 *
 *   1. The host is the API's, not the app's. A pass came out as
 *      `api.credopass.com/p/<token>`, and `/p/:token` is a route in
 *      `apps/web` — the API has never served it. Every link 404'd.
 *   2. The scheme is whatever reached the Bun process. Behind Coolify's TLS
 *      terminator that is plain `http`, so the printed link was
 *      `http://api.credopass.com/...` and the redirect lost the path.
 *
 * Since no email exists yet (D18), the pass URL shown on screen is the ONLY
 * copy an attendee ever gets. A dead link there is a dead feature.
 *
 * WHAT IT IS NOW. A known constant per environment, overridable with
 * PUBLIC_APP_URL. The app's public origin is deployment knowledge — it cannot
 * be derived from a request, and inferring it from forwarded headers would
 * mean trusting a header a client can set.
 */

const DEV_ORIGIN = 'http://localhost:5000';

/**
 * There is one production web app and its host is not a secret or a surprise,
 * so requiring the deployment to restate it buys nothing and costs a boot
 * failure the first time someone forgets. The env var is the override, not the
 * obligation.
 */
const PRODUCTION_ORIGIN = 'https://app.credopass.com';

/**
 * The public origin of the web app, with no trailing slash.
 *
 * `PUBLIC_APP_URL` wins when set. Otherwise: the deployed app in production,
 * the Vite dev server everywhere else.
 */
export function publicAppUrl(): string {
  const raw = process.env.PUBLIC_APP_URL?.trim();

  if (!raw) {
    return process.env.NODE_ENV === 'production' ? PRODUCTION_ORIGIN : DEV_ORIGIN;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`PUBLIC_APP_URL is not a valid absolute URL: ${raw}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`PUBLIC_APP_URL must be http or https, got: ${raw}`);
  }
  return parsed.origin;
}

/**
 * Called at boot so a malformed override fails on startup rather than on the
 * first registration.
 */
export function assertPublicAppUrl(): void {
  publicAppUrl();
}
