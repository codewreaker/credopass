import { createMiddleware } from 'hono/factory';
import { jwk } from 'hono/jwk';

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
 */

// Paths served without a token (docs + health probes)
const PUBLIC_SUFFIXES = ['/health', '/docs', '/openapi.json'];

export function createAuthMiddleware() {
  if (process.env.AUTH_DISABLED === 'true') {
    console.warn(
      '⚠️  AUTH_DISABLED=true - API authentication is OFF. ' +
      'Every route is reachable without a token. Do not use in production.'
    );
    return createMiddleware(async (_c, next) => next());
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL is required to verify API tokens against the Supabase JWKS. ' +
      'Set it in services/core/.env (or set AUTH_DISABLED=true for local dev only).'
    );
  }

  const verify = jwk({
    jwks_uri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    alg: ['ES256', 'RS256'],
  });

  return createMiddleware(async (c, next) => {
    if (PUBLIC_SUFFIXES.some((s) => c.req.path.endsWith(s))) {
      return next();
    }
    return verify(c, next);
  });
}
