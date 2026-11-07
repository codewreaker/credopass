/**
 * Refuse to boot the dev server against a database that is not local.
 *
 *   bun run scripts/guard-db-host.ts [--allow-remote]
 *
 * WHY THIS EXISTS. Bun will not override a variable already in the
 * environment, so `export DATABASE_URL=<remote>` in a shell — left over from a
 * remote migration — silently beats `services/core/.env` for every command run
 * from that tab. On 2026-11-07 a full storage verification ran against
 * production that way, writing real rows, because the boot log said
 * `✓ PostgreSQL connected (local)` while connected to Supabase.
 *
 * WHY A FLAG AND NOT AN ENV VAR. `scripts/db.ts` argues for a hostname
 * allow-list over a `--force` flag, on the grounds that a flag can be passed by
 * accident. That reasoning does not transfer here, and inverts: the bug being
 * guarded against IS an inherited environment variable. An argv flag cannot be
 * inherited — it has to be typed on the command line, in this invocation. So
 * the escape hatch is a flag precisely because the hazard is the environment.
 *
 * WHY NOT IN `src/index.ts`. That file is the production entrypoint
 * (`Dockerfile` → `CMD ["bun", "run", "services/core/index.js"]`). A
 * localhost-only check there would refuse to boot on Coolify. This script runs
 * only from the `coreservice:start` nx target, which is development-only —
 * `NODE_ENV=development`, `bun --watch`. CI never calls it.
 */

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal', '::1'];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('\nDATABASE_URL is not set. See services/core/.env.example\n');
  process.exit(1);
}

let host: string;
try {
  host = new URL(url).hostname;
} catch {
  console.error(`\nDATABASE_URL is not a valid URL: ${url.slice(0, 24)}…\n`);
  process.exit(1);
}

const isLocal = LOCAL_HOSTS.includes(host);
const allowRemote = process.argv.includes('--allow-remote');

/**
 * Where the value actually came from. This is the whole point of the guard: the
 * file can say one thing and the process another, and only the process matters.
 */
const source = process.env.npm_lifecycle_script?.includes('DATABASE_URL')
  ? 'the nx target'
  : 'the environment (exported in this shell — it OVERRIDES .env)';

if (isLocal) {
  console.log(`\n🗄  Database host: ${host}  (local)\n`);
  process.exit(0);
}

if (allowRemote) {
  const rule = '='.repeat(70);
  console.log(`
${rule}
  BOOTING AGAINST A REMOTE DATABASE

  Host:   ${host}
  Via:    --allow-remote

  Writes from this dev server hit real data. Seeds and resets are still
  refused (scripts/db.ts allow-lists localhost).
${rule}
`);
  process.exit(0);
}

console.error(`
REFUSING TO START.

  DATABASE_URL points at:  ${host}
  Allowed without a flag:  ${LOCAL_HOSTS.join(', ')}

  Set from:  ${source}

This is the 2026-11-07 footgun: an exported DATABASE_URL beats .env, because
Bun will not override a variable that is already set. The old boot log claimed
"(local)" regardless, so the only clue was the rows appearing in production.

To aim at your local database (what you almost certainly want):

  unset DATABASE_URL          # then start again; .env takes over

To do this deliberately, against real data:

  nx run coreservice:start:allow-remote
`);
process.exit(1);
