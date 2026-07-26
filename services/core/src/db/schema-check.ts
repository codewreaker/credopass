/**
 * Does the database this service is pointed at actually have the schema the
 * code expects?
 *
 * Written after a real half-hour of confusion: DATABASE_URL pointed at an
 * instance the Phase 1 migrations had never been applied to, so every
 * authenticated request answered a bare `500 internal_error` with nothing to
 * act on. The tables were fine, the code was fine, the *pairing* was wrong —
 * and nothing said so.
 *
 * Checked once at boot and reported by /health/ready. Not fatal: the service
 * still starts and serves /health and /docs, so a container health check goes
 * green and the problem is visible rather than crash-looping.
 */

import { getDatabase } from './client';

/** Tables the rebuild's endpoints need. Add to this when a phase adds tables. */
const REQUIRED_TABLES = [
  'accounts',
  'identities',
  'people',
  'invitations',
  'org_identity_providers',
  'org_domains',
  'organizations',
  'org_memberships',
  'events',
] as const;

export interface SchemaStatus {
  ok: boolean;
  missing: string[];
  checkedAt: Date;
}

let cached: SchemaStatus | null = null;

export async function checkSchema(force = false): Promise<SchemaStatus> {
  if (cached && !force) return cached;

  const db = await getDatabase();
  const { sql } = await import('drizzle-orm');

  const rows = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );

  const present = new Set(
    (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []).map(
      (r) => (r as { tablename: string }).tablename
    )
  );

  const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
  cached = { ok: missing.length === 0, missing, checkedAt: new Date() };
  return cached;
}

/**
 * Log the verdict at boot. Says what is wrong AND what to type — a diagnostic
 * that does not tell you the fix has only done half the job.
 */
export async function reportSchemaAtBoot(): Promise<void> {
  let status: SchemaStatus;
  try {
    status = await checkSchema(true);
  } catch (err) {
    console.warn(
      `⚠️  Could not check the database schema: ${(err as Error).message}\n` +
        `   /api/v1/core will return 500 on anything that touches the database.`
    );
    return;
  }

  if (status.ok) {
    console.log('🗄️  Schema: all expected tables present');
    return;
  }

  const url = process.env.DATABASE_URL ?? '';
  const target = url.replace(/:[^:@/]+@/, ':****@');
  const isRemote = Boolean(url) && !/@(localhost|127\.0\.0\.1|host\.docker\.internal)/.test(url);

  // Migrating a remote instance is production-adjacent, so the advice differs:
  // point local dev at a local database rather than reaching for `migrate`.
  const advice = isRemote
    ? `   This is a REMOTE database. For local development, point at a local one:\n` +
      `     DATABASE_URL=postgresql://postgres:Ax!rtrysoph123@localhost:5432/credopass_db\n` +
      `     cd services/core && bunx drizzle-kit migrate\n\n` +
      `   Only migrate the remote deliberately, after testing locally.`
    : `   Apply the migrations:\n` + `     cd services/core && bunx drizzle-kit migrate`;

  console.warn(
    `\n⚠️  DATABASE SCHEMA IS OUT OF DATE — /api/v1/core WILL RETURN 500\n` +
      `\n   Missing tables: ${status.missing.join(', ')}` +
      `\n   Database:       ${target || '(DATABASE_URL not set)'}` +
      `\n\n${advice}` +
      `\n\n   /api/core (the old surface) is unaffected and keeps working.\n`
  );
}
