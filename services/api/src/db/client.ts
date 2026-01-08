// ============================================================================
// FILE: packages/database/src/client.ts
// Database client factory with auto-detection: PGlite (local) or PostgreSQL (hosted)
// ============================================================================

import { PGlite } from '@electric-sql/pglite';
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

// Database types
export type PgliteDB = PgliteDatabase<typeof schema>;
export type PostgresDB = PostgresJsDatabase<typeof schema>;
export type Database = PgliteDB | PostgresDB;

// Singleton database instance
let db: Database | null = null;
let client: PGlite | postgres.Sql | null = null;

/**
 * Create a database client for Postgres (hosted environments)
 */
export function createDatabaseClient(connectionString: string): PostgresDB {
  const postgresClient = postgres(connectionString);
  return drizzlePostgres(postgresClient, { schema });
}

/**
 * Create a PGlite client for local development
 */
export async function createPgliteClient(dbPath: string): Promise<PgliteDB> {
  const pgliteClient = new PGlite(dbPath);
  await pgliteClient.waitReady;
  return drizzlePglite(pgliteClient, { schema });
}

/**
 * Get database instance with auto-detection
 * Uses PostgreSQL on hosted services, PGlite for local development
 */
export async function getDatabase(): Promise<Database> {
  if (db) return db;

  // Use PostgreSQL on hosted services (Vercel, Netlify, Cloudflare)
  if (isHosted && process.env.DATABASE_URL) {
    const postgresClient = postgres(process.env.DATABASE_URL);
    db = drizzlePostgres(postgresClient, { schema });
    client = postgresClient;
    const platform = isEdgeLight ? 'Vercel Edge' : isWorkerd ? 'Cloudflare Workers' : isNetlify ? 'Netlify' : 'Hosted';
    console.log(`✓ PostgreSQL connected (${platform})`);
  }
  // Use PostgreSQL if DATABASE_URL is explicitly set
  else if (process.env.DATABASE_URL) {
    const postgresClient = postgres(process.env.DATABASE_URL);
    db = drizzlePostgres(postgresClient, { schema });
    client = postgresClient;
    console.log('✓ PostgreSQL connected (DATABASE_URL)');
  }
  // Fallback to PGlite for local development
  else {
    const dbPath = process.env.PGLITE_PATH || path.join(process.cwd(), 'data', 'credopass');
    const pgliteClient = new PGlite(dbPath);
    await pgliteClient.waitReady;
    db = drizzlePglite(pgliteClient, { schema });
    client = pgliteClient;
    console.log(`✓ PGlite connected (local): ${dbPath}`);
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
