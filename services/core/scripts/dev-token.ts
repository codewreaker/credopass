/**
 * Mint a JWT for poking at the API by hand.
 *
 *   nx run coreservice:token
 *
 * Signs in anonymously against the configured Supabase (local or remote) and
 * prints the access token. Paste it into the Scalar client's auth box at
 * /api/v1/core/docs, or use it with curl.
 *
 * This is a real token through the real auth path — not a bypass. There is
 * deliberately no way to fabricate one, because a dev-only "skip auth" switch
 * is how the auth path ends up being the least exercised code in the product
 * (docs/API-FIRST-REBUILD.md §9.3).
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(`
Missing configuration.

  SUPABASE_URL      ${url ? '✓' : '✗ not set'}
  SUPABASE_ANON_KEY ${anonKey ? '✓' : '✗ not set'}

Set them in services/core/.env (see .env.example). For a local stack:
  SUPABASE_URL=http://localhost:54321
`);
  process.exit(1);
}

const supabase = createClient(url, anonKey);
const { data, error } = await supabase.auth.signInAnonymously();

if (error || !data.session) {
  console.error(`Could not mint a token: ${error?.message ?? 'no session returned'}`);
  console.error('Anonymous sign-in must be enabled on the Supabase project.');
  process.exit(1);
}

const { access_token, expires_at } = data.session;
const expires = expires_at ? new Date(expires_at * 1000).toLocaleTimeString() : 'unknown';

console.log(`
Token (expires ${expires}, user ${data.user?.id}):

${access_token}

Use it:
  · Scalar  http://localhost:8080/api/v1/core/docs  →  paste into the auth box
  · curl    curl -H "Authorization: Bearer $TOKEN" \\
              http://localhost:8080/api/v1/core/health
`);
