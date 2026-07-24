import { createMiddleware } from 'hono/factory';
import { jwk } from 'hono/jwk';
import type { MiddlewareHandler } from 'hono';

/**
 * Supabase JWT verification for every API route.
 *
 * Tokens are ES256-signed by Supabase Auth and verified against the
 * project's public JWKS endpoint - no shared secret required. The
 * verified payload is available to handlers via c.get('jwtPayload')
 * (sub = auth user id, email, is_anonymous, ...).
 *
 * Configuration:
 *   SUPABASE_URL   - project URL, e.g. https://<ref>.supabase.co (required)
 *   AUTH_DISABLED  - "true" skips verification entirely. Local-dev escape
 *                    hatch only; never set in production.
 *
 * Boot safety: this NEVER throws at import/construction time. The JWKS verifier
 * is built lazily on the first protected request. If SUPABASE_URL is missing the
 * service still boots and serves /health, /docs and /openapi.json — protected
 * routes return 500 with a clear message — so a container health check goes
 * green and a misconfig is visible without crash-looping the deploy.
 */

// Paths served without a token (docs + health probes)
const PUBLIC_SUFFIXES = ['/health', '/docs', '/openapi.json'];

// The token-optional public event surface (mounted before this middleware in
// index.ts). This prefix check is defence-in-depth: even if route ordering
// changes, anything under `/public/` stays reachable without a JWT.
const PUBLIC_PREFIX = '/api/core/public/';

export function createAuthMiddleware(): MiddlewareHandler {
  if (process.env.AUTH_DISABLED === 'true') {
    console.warn(
      '⚠️  AUTH_DISABLED=true - API authentication is OFF. ' +
      'Every route is reachable without a token. Do not use in production.'
    );
    return createMiddleware(async (_c, next) => next());
  }

  // Built on first use, then cached. Kept out of module scope so importing this
  // file (and calling createAuthMiddleware) never touches env or throws.
  let verify: ReturnType<typeof jwk> | null = null;

  const getVerifier = (): ReturnType<typeof jwk> | null => {
    if (verify) return verify;
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) return null;
    verify = jwk({
      jwks_uri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      alg: ['ES256', 'RS256'],
    });
    return verify;
  };

  return createMiddleware(async (c, next) => {
    if (
      c.req.path.includes(PUBLIC_PREFIX) ||
      PUBLIC_SUFFIXES.some((s) => c.req.path.endsWith(s))
    ) {
      return next();
    }

    const verifier = getVerifier();
    if (!verifier) {
      console.error(
        'SUPABASE_URL is not set — cannot verify API tokens. ' +
        'Set SUPABASE_URL in the environment (or AUTH_DISABLED=true for local dev only).'
      );
      return c.json({ error: 'auth not configured' }, 500);
    }

    return verifier(c, next);
  });
}
