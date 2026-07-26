/**
 * Drop the local database's schema and rebuild it from the committed migrations.
 *
 *   nx run coreservice:db:reset
 *
 * WHY THIS EXISTS. A database created by `drizzle-kit push` has tables but an
 * empty migration journal, so `drizzle-kit migrate` then tries to CREATE TABLE
 * over the top and fails. The database looks fine and is unusable — which is
 * exactly the state this repo's local database was in. Rebuilding from
 * migrations is the only way to know that what you are developing against is
 * what CI and production will get.
 *
 * REFUSES TO RUN AGAINST A REMOTE HOST. This is a destructive operation whose
 * whole job is to drop everything; a typo in DATABASE_URL must not be able to
 * take out a live instance. The guard is a hostname allow-list, not a flag,
 * because a flag is something you can pass by accident.
 */

import { $ } from 'bun';
import { Client } from 'pg';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal', '::1'];

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is not set. Point it at your local database first.');
  process.exit(1);
}

let host: string;
try {
  host = new URL(url).hostname;
} catch {
  console.error(`DATABASE_URL is not a valid URL: ${url.replace(/:[^:@/]+@/, ':****@')}`);
  process.exit(1);
}

if (!LOCAL_HOSTS.includes(host)) {
  console.error(`
REFUSING TO RUN.

  DATABASE_URL points at:  ${host}
  This script only runs against: ${LOCAL_HOSTS.join(', ')}

It DROPS the public schema. Running it against a remote instance would destroy
real data, so the host is checked rather than trusted.

To reset a local database, point DATABASE_URL at it:
  DATABASE_URL=postgresql://postgres:Ax!rtrysoph123@localhost:5432/credopass_db
`);
  process.exit(1);
}

const safeUrl = url.replace(/:[^:@/]+@/, ':****@');
console.log(`\nResetting ${safeUrl}\n`);

const client = new Client({ connectionString: url });
await client.connect();

// Show what is about to be lost. A destructive command that runs silently is
// how people lose work they did not know was there.
const { rows: before } = await client.query<{ tablename: string }>(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
);
console.log(
  before.length
    ? `[1/3] Dropping ${before.length} existing table(s): ${before.map((r) => r.tablename).join(', ')}`
    : '[1/3] No existing tables to drop'
);

// `app` holds the RLS helper functions, `drizzle` holds the migration journal.
// All three must go together — leaving the journal behind is what produces the
// "tables exist but migrations say zero" state this script exists to fix.
await client.query(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  DROP SCHEMA IF EXISTS app CASCADE;
  DROP SCHEMA IF EXISTS drizzle CASCADE;
  GRANT ALL ON SCHEMA public TO postgres;
`);

await client.end();
console.log('      ✓ schemas public, app, drizzle dropped and recreated');

console.log('[2/3] Applying migrations from scratch');
try {
  await $`bunx drizzle-kit migrate`.cwd(ROOT).quiet();
  console.log('      ✓ migrations applied');
} catch (e) {
  console.error(`      ✗ migrate failed:\n${e}`);
  process.exit(1);
}

console.log('[3/3] Verifying');
const verify = new Client({ connectionString: url });
await verify.connect();

const { rows: tables } = await verify.query<{ tablename: string }>(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
);
const { rows: policies } = await verify.query<{ n: string }>(
  `SELECT count(*)::text AS n FROM pg_policies WHERE schemaname = 'public'`
);
const { rows: applied } = await verify.query<{ n: string }>(
  `SELECT count(*)::text AS n FROM drizzle.__drizzle_migrations`
);
const { rows: role } = await verify.query<{ rolbypassrls: boolean }>(
  `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'credopass_api'`
);

await verify.end();

console.log(`      ✓ ${tables.length} tables`);
console.log(`      ✓ ${policies[0].n} RLS policies`);
console.log(`      ✓ ${applied[0].n} migrations recorded`);
console.log(
  role.length
    ? `      ✓ role credopass_api (bypassrls: ${role[0].rolbypassrls})`
    : '      ! role credopass_api missing'
);

console.log(`
✅ Database reset.

   ${tables.map((t) => t.tablename).join(', ')}

Next:
  nx run coreservice:seed     sample data (optional)
  bun start                   web + API
`);
