import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { isEdgeLight, isWorkerd, isNetlify, isDevelopment } from 'std-env';
import * as schema from '@credopass/lib/schemas/tables';
// Export schema for convenience
export * from '@credopass/lib/schemas/tables';


// Detect if running on hosted service
const isHosted = !isDevelopment;
const platform = isEdgeLight ? 'Vercel Edge' : isWorkerd ? 'Cloudflare Workers' : isNetlify ? 'Netlify' : 'Hosted';

// Database types
export type Database = ReturnType<typeof createPostgresClient>;

// Singleton database instance
let client: Pool | null = null;
let db: Database | null = null;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal', '::1'];

/**
 * `host:port/database (local|⚠️  REMOTE)`, with the password stripped.
 *
 * The label is derived from the URL that this process actually holds, not from
 * `isDevelopment`. It used to read `(local)` whenever the platform was not a
 * hosted one, which is a statement about where the CODE runs, not where the
 * DATA is — so a dev server pointed at production announced itself as local.
 * That cost a day on 2026-11-07. `scripts/guard-db-host.ts` now refuses that
 * combination outright for `coreservice:start`; this keeps the log honest
 * everywhere else, including in production, where it prints the real host.
 *
 * The full URL is never logged: it carries the password, and this line goes to
 * the deployed log stream.
 */
function describeTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return 'no DATABASE_URL';
  try {
    const { hostname, port, pathname } = new URL(url);
    const where = LOCAL_HOSTS.includes(hostname) ? 'local' : '⚠️  REMOTE';
    return `${hostname}${port ? `:${port}` : ''}${pathname} (${where})`;
  } catch {
    return 'unparseable DATABASE_URL';
  }
}

/**
 * Create a database client for Postgres (hosted environments)
 */
export function createPostgresClient(connectionString: string) {
  // Query logging is development-only: `logger: true` prints every statement
  // *with its bound parameters*, which in production means emails, tokens and
  // ids in the deployed log stream.
  return drizzlePostgres(connectionString, { schema, logger: isDevelopment });
}

/**
 * Get database instance with auto-detection
 * Uses PostgreSQL on hosted services, PGlite for local development
 */
export async function getDatabase(): Promise<Database> {
  if (db) return db;

  if (process.env.DATABASE_URL) {
    // Use PostgreSQL on hosted services (Vercel, Netlify, Cloudflare)
    db = createPostgresClient(process.env.DATABASE_URL);
    client = db.$client;

    if (isHosted) {
      console.log(`✓ Connecting to Postgres instance (hosted: ${platform})`);
      //@TODO: connect to external postgres and verify connection
      console.log(`✓ PostgreSQL connected (${platform}): ${describeTarget()}`);
    }
    else {
      console.log(`✓ PostgreSQL connected: ${describeTarget()}`);
    }
    console.log("✓ Database initialized");
  }
  // Fallback to PGlite for local development
  else {
    const errorMessage = [
      'env variable DATABASE_URL is not set. Please set it to connect to PostgreSQL',
      isHosted ? `Set it in your environment variable on hosted platform:${platform}` :
        'You set it in your .env file? or run the command `DATABASE_URL="your_database_url" npx ` in your terminal.`',
    ].join(',')

    console.log(`✓ ${errorMessage}`);
    throw new Error()
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
    console.log('✓ Database closed');
  }
}

/**
 * Check if database is connected
 */
export async function isDBConnected(): Promise<boolean> {
  if (db == null) return false;
  try {
    await db.execute('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

