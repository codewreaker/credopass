/**
 * Postgres for integration and adversarial tests.
 *
 * §12.5, "the honest bit": the current suite skips itself when DATABASE_URL is
 * absent, so a bare CI checkout reports success while running nothing. That
 * pattern does not survive. This harness FAILS when it cannot get a database —
 * loudly, with the reason — because a tenancy suite that silently ran zero
 * tests is worse than no tenancy suite at all.
 *
 * Resolution order:
 *   1. TEST_DATABASE_URL — an already-running throwaway Postgres (fastest; what
 *      CI uses when it has a service container).
 *   2. Testcontainers — starts postgres:16 on demand. Needs a Docker daemon.
 * Never the developer's real DATABASE_URL: these tests truncate tables.
 *
 * It also sets `PASS_SIGNING_KEY` below. Not this module's subject, but this is
 * the one thing every DB-backed suite calls, so it is the only place the default
 * cannot be forgotten — which it was, in the adversarial suite, until CI went red
 * on a 500 from `POST /public/events/{id}/register`.
 */

/**
 * `PassService.keyFor` throws when this is unset — correctly, because a default
 * signing key is the same as no signature. Bun auto-loads `services/core/.env`,
 * so a maintainer's machine has a key and a fresh clone or a CI runner does not;
 * the suite was green locally and red in CI for exactly that reason.
 *
 * The value protects nothing: it signs tokens minted and verified inside this
 * process, against a database that is truncated between suites. Same category as
 * the `postgres:postgres` test credentials in `.env.example`.
 *
 * `??=`, never `=`: a runner with a real key, or a test exercising the
 * key-absent branch, still wins.
 */
process.env.PASS_SIGNING_KEY ??= 'test-signing-key-not-for-production';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = resolve(HERE, '../../../drizzle');

export interface TestDatabase {
  url: string;
  pool: Pool;
  db: ReturnType<typeof drizzle>;
  /** Truncate every table. Cheaper and safer than recreating the container. */
  reset(): Promise<void>;
  stop(): Promise<void>;
}

let container: StartedPostgreSqlContainer | null = null;

async function resolveUrl(): Promise<string> {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  try {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('credopass_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    return container.getConnectionUri();
  } catch (cause) {
    throw new Error(
      'Could not obtain a test database.\n\n' +
        'These tests require a real Postgres — they exercise migrations, RLS policies\n' +
        'and transactions, none of which can be faked. Provide one of:\n\n' +
        '  · TEST_DATABASE_URL pointing at a throwaway Postgres, or\n' +
        '  · a running Docker daemon, so Testcontainers can start postgres:16.\n\n' +
        'This suite deliberately fails rather than skipping (§12.5): a tenancy suite\n' +
        'that silently ran nothing would report green while the product leaked.\n\n' +
        `Underlying cause: ${(cause as Error).message}`,
      { cause: cause as Error }
    );
  }
}

let instance: Promise<TestDatabase> | null = null;

export function getTestDatabase(): Promise<TestDatabase> {
  if (instance) return instance;

  instance = (async () => {
    const url = await resolveUrl();

    // Point the APPLICATION at the test database too.
    //
    // Route-level tests call the real handlers, which call `getDatabase()`,
    // which reads DATABASE_URL. Without this the fixtures write to the test
    // database and the handlers read the DEV one — every request 404s and the
    // reason is invisible. Worse, a write-path test would mutate real dev data.
    //
    // `getDatabase()` is lazy and memoised, so this must happen before the
    // first request — which it does, because every suite awaits this first.
    process.env.DATABASE_URL = url;

    const pool = new Pool({ connectionString: url });
    const db = drizzle(pool);

    // Migrations run from scratch on an empty database — the same gate CI
    // applies (§9.4), so a migration that only works incrementally fails here.
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const reset = async () => {
      const { rows } = await pool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%'`
      );
      if (rows.length === 0) return;
      const list = rows.map((r) => `public."${r.tablename}"`).join(', ');
      await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    };

    const stop = async () => {
      await pool.end();
      if (container) await container.stop();
      container = null;
      instance = null;
    };

    return { url, pool, db, reset, stop };
  })();

  return instance;
}
