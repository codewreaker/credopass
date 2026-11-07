/**
 * Show how to get a JWT for poking at the API by hand.
 *
 *   nx run coreservice:token
 *
 * This script creates nothing and talks to nothing. It used to call
 * `supabase.auth.signInAnonymously()`, which was a mistake worth remembering:
 * `SUPABASE_URL` is the live project and there is no local Supabase, so every
 * invocation registered a real anonymous auth user in production — nine in a
 * single day on 2026-11-07 before anyone noticed.
 *
 * It was not fixable by pointing it somewhere else, either. The issuer registry
 * verifies signatures against the issuer's REMOTE JWKS (asymmetric), so there is
 * no secret here with which to sign a token locally — by design. A dev-only
 * "skip auth" switch is how the auth path ends up the least exercised code in
 * the product (docs/API-FIRST-REBUILD.md §9.3), and `AUTH_DISABLED` was removed
 * for that reason.
 *
 * So the only honest token is one the real Google sign-in already issued. Take
 * it from the browser session you already have.
 */

const url = process.env.SUPABASE_URL;

if (!url) {
  console.error(`
SUPABASE_URL is not set, so I cannot tell you which storage key to read.

Set it in services/core/.env (see .env.example).
`);
  process.exit(1);
}

/** `https://abcdefg.supabase.co` → `abcdefg`; a local stack has no ref. */
const host = new URL(url).hostname;
const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : null;
const storageKey = ref ? `sb-${ref}-auth-token` : 'sb-localhost-auth-token';

console.log(`
Supabase project: ${url}${ref ? '' : '  (local stack)'}

This command no longer mints a token — doing so created a real auth user in
that project every time it ran. Take the token from your signed-in browser
session instead.

  1. Sign in to the web app (http://localhost:5001) with Google.
  2. Open the browser console on that tab and run:

     JSON.parse(localStorage.getItem('${storageKey}')).access_token

  3. Copy the string it prints.

Use it:
  · Scalar  http://localhost:8080/api/v1/core/docs  →  paste into the auth box
  · curl    curl -H "Authorization: Bearer $TOKEN" \\
              http://localhost:8080/api/v1/core/me

The token is short-lived; repeat step 2 when it expires. If you want tokens
without touching production, stand up a local Supabase — supabase init &&
supabase start, then SUPABASE_URL=http://localhost:54321.
`);
