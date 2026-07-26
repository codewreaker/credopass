/**
 * What state is the database in, and does it match the code?
 *
 *   nx run coreservice:db:status
 *
 * Answers the question that cost half a day: "is this database the one my code
 * expects?" Reports the host, the tables, the migration journal and whether
 * those two agree — because "tables exist" and "migrations applied" are
 * different facts, and a `drizzle-kit push` database has the first without the
 * second.
 *
 * Read-only. Safe against any database, including remote.
 */

import { Client } from 'pg';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = ['localhost', '127.0.0.1', 'host.docker.internal'].includes(host);

console.log(`\nDatabase: ${url.replace(/:[^:@/]+@/, ':****@')}`);
console.log(`Host:     ${host} ${isLocal ? '(local)' : '⚠️  (REMOTE)'}\n`);

const client = new Client({ connectionString: url });
try {
  await client.connect();
} catch (e) {
  console.error(`Could not connect: ${(e as Error).message}\n`);
  console.error('Is the container running?  nx run coreservice:dev:up\n');
  process.exit(1);
}

const { rows: tables } = await client.query<{ tablename: string }>(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
);
const { rows: policies } = await client.query<{ tablename: string; policyname: string }>(
  `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY 1`
);
const { rows: role } = await client.query<{ rolbypassrls: boolean }>(
  `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'credopass_api'`
);

let applied: string[] = [];
let journalExists = true;
try {
  const { rows } = await client.query<{ hash: string }>(
    `SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at`
  );
  applied = rows.map((r) => r.hash);
} catch {
  journalExists = false;
}

await client.end();

const onDisk = (await readdir(resolve(import.meta.dir, '../drizzle')))
  .filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f))
  .sort();

console.log(`Tables (${tables.length}): ${tables.map((t) => t.tablename).join(', ') || '(none)'}`);
console.log(`RLS policies: ${policies.length}`);
console.log(`credopass_api role: ${role.length ? `yes (bypassrls: ${role[0].rolbypassrls})` : 'no'}`);
console.log(`Migrations on disk: ${onDisk.length}`);
console.log(`Migrations applied: ${journalExists ? applied.length : 'no journal'}`);

// The three states worth distinguishing, and what to do about each.
console.log('');
if (!journalExists && tables.length > 0) {
  console.log(`⚠️  Tables exist but there is NO migration journal.

   This database was created with \`drizzle-kit push\`, not migrations. Running
   \`drizzle-kit migrate\` will try to CREATE TABLE over the top and fail.

   Fix (destroys local data):
     nx run coreservice:db:reset
`);
  process.exit(1);
}

if (applied.length < onDisk.length) {
  console.log(`⚠️  ${onDisk.length - applied.length} migration(s) not applied.

   Missing: ${onDisk.slice(applied.length).join(', ')}

   Fix:
     cd services/core && bunx drizzle-kit migrate
`);
  process.exit(1);
}

console.log('✅ Schema is up to date with the committed migrations.\n');
