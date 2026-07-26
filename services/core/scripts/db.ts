/**
 * One entry point for everything database.
 *
 *   nx run coreservice:db            → status (safe, read-only)
 *   nx run coreservice:db reset      → drop, migrate, seed
 *   nx run coreservice:db migrate    → apply pending migrations
 *   nx run coreservice:db seed       → sample data
 *   nx run coreservice:db join       → make yourself an owner of a seeded org
 *
 * Replaces db-reset.ts, db-status.ts and a separate seed entry point. Three
 * scripts that each connected to Postgres, each masked a password, and each
 * decided independently what "healthy" meant is three places for those answers
 * to drift.
 */

import { $ } from 'bun';
import { Client } from 'pg';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal', '::1'];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. See services/core/.env.example');
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = LOCAL_HOSTS.includes(host);
const safeUrl = url.replace(/:[^:@/]+@/, ':****@');

const connect = async (): Promise<Client> => {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
  } catch (e) {
    console.error(`\nCould not connect to ${safeUrl}\n  ${(e as Error).message}`);
    console.error('\nIs the container running?   nx run coreservice:dev:up\n');
    process.exit(1);
  }
  return client;
};

/**
 * Destructive commands only ever run against localhost.
 *
 * A hostname allow-list rather than a --force flag, because a flag is something
 * you can pass by accident and a hostname is a fact about where you are aimed.
 */
const refuseRemote = (command: string): void => {
  if (isLocal) return;
  console.error(`
REFUSING TO ${command.toUpperCase()}.

  DATABASE_URL points at:  ${host}
  Destructive commands only run against: ${LOCAL_HOSTS.join(', ')}

Point DATABASE_URL at your local database first.
`);
  process.exit(1);
};

// ---------------------------------------------------------------------------

async function status(quiet = false): Promise<boolean> {
  const client = await connect();

  const { rows: tables } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
  );
  const { rows: policies } = await client.query(
    `SELECT 1 FROM pg_policies WHERE schemaname = 'public'`
  );
  const { rows: role } = await client.query<{ rolbypassrls: boolean }>(
    `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'credopass_api'`
  );

  let applied: number | null = null;
  try {
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM drizzle.__drizzle_migrations`
    );
    applied = Number(rows[0].n);
  } catch {
    applied = null; // no journal at all
  }

  await client.end();

  const onDisk = (await readdir(resolve(ROOT, 'drizzle')))
    .filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f))
    .sort();

  if (!quiet) {
    console.log(`\nDatabase: ${safeUrl}`);
    console.log(`Host:     ${host} ${isLocal ? '(local)' : '⚠️  REMOTE'}\n`);
    console.log(`Tables (${tables.length}): ${tables.map((t) => t.tablename).join(', ') || '(none)'}`);
    console.log(`RLS policies:       ${policies.length}`);
    console.log(`credopass_api role: ${role.length ? `yes (bypassrls: ${role[0].rolbypassrls})` : 'no'}`);
    console.log(`Migrations:         ${applied ?? 'no journal'} applied / ${onDisk.length} on disk\n`);
  }

  // The three states worth telling apart, and what to do about each.
  if (applied === null && tables.length > 0) {
    console.log(`⚠️  Tables exist but there is NO migration journal.

   This database was built with \`drizzle-kit push\`, not migrations, so
   \`migrate\` will try to CREATE TABLE over the top and fail.

   Fix:  nx run coreservice:db reset      ← destroys local data
`);
    return false;
  }

  if ((applied ?? 0) < onDisk.length) {
    console.log(`⚠️  ${onDisk.length - (applied ?? 0)} migration(s) not applied.

   Fix:  nx run coreservice:db migrate
`);
    return false;
  }

  if (!quiet) console.log('✅ Schema matches the committed migrations.\n');
  return true;
}

async function migrate(): Promise<void> {
  console.log(`Applying migrations to ${safeUrl}`);
  await $`bunx drizzle-kit migrate`.cwd(ROOT);
  console.log('✓ migrations applied');
}

async function reset(): Promise<void> {
  refuseRemote('reset');
  const client = await connect();

  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
  );
  console.log(
    rows.length
      ? `[1/3] Dropping ${rows.length} table(s)`
      : '[1/3] Nothing to drop'
  );

  // All three schemas together. Leaving the journal behind is exactly what
  // produces the "tables exist but migrations say zero" state.
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    DROP SCHEMA IF EXISTS app CASCADE;
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    GRANT ALL ON SCHEMA public TO postgres;
  `);
  await client.end();

  console.log('[2/3] Applying migrations from scratch');
  await $`bunx drizzle-kit migrate`.cwd(ROOT).quiet();

  console.log('[3/3] Seeding');
  await seed();

  await status();
}

async function seed(): Promise<void> {
  refuseRemote('seed');
  await import('../src/db/seed');
}

/**
 * Make the calling account an owner of a seeded organisation.
 *
 * Exists because the alternative was printing raw SQL for the reader to paste —
 * which is a instruction, not a tool. `GET /me` gives you the id.
 */
async function join(accountId?: string, slug = 'kharis-church'): Promise<void> {
  if (!accountId) {
    console.error(`
Usage: nx run coreservice:db join <account-id> [org-slug]

Get your account id by calling GET /me:
  nx run coreservice:token     → mint a JWT
  then GET /api/v1/core/me in the docs at /api/v1/core/docs
`);
    process.exit(1);
  }

  const client = await connect();
  const { rows } = await client.query(
    `INSERT INTO org_memberships (organization_id, account_id, role)
     SELECT id, $1, 'owner' FROM organizations WHERE slug = $2
     ON CONFLICT (organization_id, account_id) DO UPDATE SET role = 'owner'
     RETURNING organization_id`,
    [accountId, slug]
  );
  await client.end();

  if (rows.length === 0) {
    console.error(`No organisation with slug "${slug}". Run: nx run coreservice:db seed`);
    process.exit(1);
  }
  console.log(`✓ ${accountId} is now an owner of "${slug}". GET /events should show its events.`);
}

// ---------------------------------------------------------------------------

const [command = 'status', ...args] = process.argv.slice(2);

switch (command) {
  case 'status':
    process.exit((await status()) ? 0 : 1);
  // eslint-disable-next-line no-fallthrough
  case 'migrate':
    await migrate();
    break;
  case 'reset':
    await reset();
    break;
  case 'seed':
    await seed();
    break;
  case 'join':
    await join(args[0], args[1]);
    break;
  default:
    console.error(`Unknown command "${command}". One of: status, migrate, reset, seed, join`);
    process.exit(1);
}

process.exit(0);
