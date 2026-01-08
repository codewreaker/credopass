// ============================================================================
// FILE: packages/database/src/client.ts
// Database client factory with auto-detection: PGlite (local) or PostgreSQL (hosted)
// ============================================================================

import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'node:path';
import { isEdgeLight, isWorkerd, isNetlify } from 'std-env';
import * as schema from './schema';

// Export schema
export * from './schema';

// Detect if running on hosted service
const isHosted = isEdgeLight || isWorkerd || isNetlify;
const platform = isEdgeLight ? 'Vercel Edge' : isWorkerd ? 'Cloudflare Workers' : isNetlify ? 'Netlify' : 'Hosted';

// Database types
export type PgliteDB = PgliteDatabase<typeof schema>;
export type PostgresDB = PostgresJsDatabase<typeof schema>;
export type Database = PgliteDB | PostgresDB;

// Singleton database instance
let db: Database | null = null;
let client: postgres.Sql | null = null;

/**
 * Create a database client for Postgres (hosted environments)
 */
export function createPostgresClient(connectionString: string): PostgresDB {
  const client = postgres(connectionString);
  return drizzlePostgres(client, { schema });
}


/**
 * Get database instance with auto-detection
 * Uses PostgreSQL on hosted services, PGlite for local development
 */
export async function getDatabase(): Promise<Database> {
  if (db) return db;

  if (process.env.DATABASE_URL) {
    // Use PostgreSQL on hosted services (Vercel, Netlify, Cloudflare)
    const client = postgres(process.env.DATABASE_URL);
    db = drizzlePostgres(client, { schema, logger: true });
    if (isHosted) {
      console.log(`✓ Connecting to Postgres instance (hosted: ${platform})`);
      //@TODO: connect to external postgres and verify connection
      console.log(`✓ PostgreSQL connected (${platform})`);
    }
    else {
      const dbPath = process.env.PGLITE_PATH || path.join(process.cwd(), 'data', 'credopass');
      const pgliteClient = new PGlite(dbPath);
      await pgliteClient.waitReady;
      db = drizzlePglite(pgliteClient, { schema });
      console.log(`✓ PostgreSQL connected (local): ${dbPath}`);
    }
  }
  // Fallback to PGlite for local development
  else {
    const errorMessage = [
      'env variable DATABASE_URL is not set. Please set it to connect to PostgreSQL',
      isHosted ? `Set it in your environment variable on hosted platform:${platform}`: 
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
    if ('close' in client) {
      await client.close();
    } else if ('end' in client) {
      await client.end();
    }
    client = null;
    db = null;
    console.log('✓ Database closed');
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return db !== null;
}

/**
 * Get connection info for logging
 */
export function getConnectionInfo(): { type: 'pglite' | 'postgres'; isHosted: boolean } {
  return {
    type: process.env.DATABASE_URL ? 'postgres' : 'pglite',
    isHosted,
  };
}
