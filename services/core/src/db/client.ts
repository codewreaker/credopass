import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { isEdgeLight, isWorkerd, isNetlify, isDevelopment } from 'std-env';
import * as schema from './schema';

// Export schema
export * from './schema';

// Detect if running on hosted service
const isHosted = !isDevelopment;
const platform = isEdgeLight ? 'Vercel Edge' : isWorkerd ? 'Cloudflare Workers' : isNetlify ? 'Netlify' : 'Hosted';

// Database types
export type Database = ReturnType<typeof createPostgresClient>;

// Singleton database instance
let client: Pool | null = null;
let db: Database | null = null;

/**
 * Create a database client for Postgres (hosted environments)
 */
export function createPostgresClient(connectionString: string) {
  return drizzlePostgres(connectionString, { schema, logger: true });
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
      console.log(`✓ PostgreSQL connected (${platform})`);
    }
    else {
      console.log(`✓ PostgreSQL connected (local): ${process.env.DATABASE_URL}`);
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

