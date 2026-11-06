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
 * WHAT IT IS NOW. A configured value. The app's public origin is deployment
 * knowledge — it cannot be derived from a request, and inferring it from
 * forwarded headers would mean trusting a header a client can set.
 */

const FALLBACK_DEV_ORIGIN = 'http://localhost:5000';

let warned = false;

/**
 * The public origin of the web app, with no trailing slash.
 *
 * Unset in development: falls back to the Vite dev server and warns once.
 * Unset anywhere else: throws. Silently emitting a wrong link is the bug.
 */
export function publicAppUrl(): string {
  const raw = process.env.PUBLIC_APP_URL?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PUBLIC_APP_URL is not set. Pass links would point at the API host and 404. ' +
          'Set it to the origin of the web app, e.g. https://app.credopass.com'
      );
    }
    if (!warned) {
      warned = true;
      console.warn(
        `⚠️  PUBLIC_APP_URL is not set — pass links will use ${FALLBACK_DEV_ORIGIN}`
      );
    }
    return FALLBACK_DEV_ORIGIN;
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
 * Called at boot so a misconfigured deployment fails on startup rather than on
 * the first registration — the same reason the route registry is asserted
 * there.
 */
export function assertPublicAppUrl(): void {
  publicAppUrl();
}
