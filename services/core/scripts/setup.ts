/**
 * One-command setup for a fresh clone.
 *
 *   nx run coreservice:setup
 *
 * Checks prerequisites, creates .env from the template, starts the containers,
 * and applies migrations to the LOCAL database. It never touches a remote
 * instance and never overwrites an existing .env.
 *
 * Every step prints what it is doing and, on failure, exactly how to fix it —
 * the point is that a new contributor is never left guessing.
 */

import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const REPO = resolve(ROOT, '../..');

let failed = false;

const step = (n: number, title: string) => console.log(`\n[${n}/6] ${title}`);
const ok = (msg: string) => console.log(`   ✓ ${msg}`);
const warn = (msg: string) => console.log(`   ! ${msg}`);
const fail = (msg: string) => {
  console.log(`   ✗ ${msg}`);
  failed = true;
};

// ---------------------------------------------------------------------------
step(1, 'Checking prerequisites');

const has = async (cmd: string) => {
  try {
    await $`which ${cmd}`.quiet();
    return true;
  } catch {
    return false;
  }
};

if (await has('bun')) ok(`bun ${Bun.version}`);
else fail('bun not found — https://bun.sh');

if (await has('docker')) {
  try {
    await $`docker info`.quiet();
    ok('docker is running');
  } catch {
    fail('docker is installed but not running — start Docker Desktop');
  }
} else {
  fail('docker not found — needed for Postgres, MinIO and the test suite');
}

if (failed) {
  console.log('\nFix the above, then run this again.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
step(2, 'Environment file');

const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
  ok('.env already exists — left untouched');
} else {
  await copyFile(resolve(ROOT, '.env.example'), envPath);
  ok('created services/core/.env from .env.example');
  warn('SUPABASE_URL and SUPABASE_ANON_KEY still need filling in');
}

// ---------------------------------------------------------------------------
step(3, 'Starting Postgres and MinIO');

try {
  await $`docker compose -f ${REPO}/docker/docker-compose.dev.yml up -d --wait credopass-postgres credopass-minio credopass-minio-init`.quiet();
  ok('postgres :5432, minio :9000 (console :9001)');
} catch (e) {
  fail(`compose failed: ${e}`);
}

// ---------------------------------------------------------------------------
step(4, 'Starting the throwaway test database');

try {
  await $`docker compose -f ${REPO}/docker/docker-compose.dev.yml --profile test up -d --wait credopass-postgres-test`.quiet();
  ok('test postgres :55432 (tmpfs — wiped on restart, by design)');
} catch (e) {
  fail(`compose failed: ${e}`);
}

// ---------------------------------------------------------------------------
step(5, 'Applying migrations to the LOCAL database');

// Deliberately overrides DATABASE_URL: `setup` must never be able to migrate a
// remote instance, whatever happens to be in .env.
const LOCAL_DB = 'postgresql://postgres:Ax!rtrysoph123@localhost:5432/credopass_db';
try {
  await $`bunx drizzle-kit migrate`.cwd(ROOT).env({ ...process.env, DATABASE_URL: LOCAL_DB }).quiet();
  ok('migrations applied to localhost:5432/credopass_db');
} catch (e) {
  warn(`migrate failed — run it yourself with DATABASE_URL set locally. ${e}`);
}

// ---------------------------------------------------------------------------
step(6, 'Generating the OpenAPI document');

try {
  await $`bun run scripts/export-openapi.ts`.cwd(ROOT).quiet();
  ok('openapi.json written');
} catch (e) {
  warn(`export failed: ${e}`);
}

// ---------------------------------------------------------------------------
console.log(`
${failed ? '⚠️  Setup finished with problems — see above.' : '✅ Setup complete.'}

Next:
  bun start                              web + API (API on :8080)
  nx run coreservice:docs                Scalar docs + API client
  nx run coreservice:token               mint a JWT to paste into Scalar
  nx run coreservice:verify              lint + typecheck + unit tests
  nx run coreservice:test:adversarial    tenancy suite (red until Phase 1 lands)
`);
