// ============================================================================
// FILE: server/db/index.ts
// Database connection with auto-detection: PGlite (local) or PostgreSQL (hosted)
// ============================================================================
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from "node:path";
import { isEdgeLight, isWorkerd, isNetlify } from 'std-env';
import * as schema from './schema';

// Export schema
export * from './schema';

// Detect if running on hosted service
const isHosted = isEdgeLight || isWorkerd || isNetlify;


if(isHosted) {
  console.log(`⚡ Running on hosted service: ${isEdgeLight ? 'Vercel Edge' : isWorkerd ? 'Cloudflare Workers' : 'Netlify'}`);
} else {
  console.log('⚡ Running in local development mode');
}

// Singleton database instance
type DatabaseType = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;
let db: DatabaseType | null = null;
let client: PGlite | postgres.Sql | null = null;

// Get Drizzle database instance with auto-detection
export async function getDatabase(): Promise<DatabaseType> {
  if (db) return db;

  // Use PostgreSQL on hosted services (Vercel, Netlify, Cloudflare)
  if (isHosted && process.env.DATABASE_URL) {
    const postgresClient = postgres(process.env.DATABASE_URL);
    db = drizzlePostgres(postgresClient, { schema });
    client = postgresClient;
    const platform = isEdgeLight ? 'Vercel Edge' : isWorkerd ? 'Cloudflare Workers' : isNetlify ? 'Netlify' : 'Hosted';
    console.log(`✓ PostgreSQL connected (${platform})`);
  }
  // Fallback to PGlite for local development
  else {
    const dbPath = path.join(process.cwd(), "data", "dwellpass");
    const pgliteClient = new PGlite(dbPath);
    await pgliteClient.waitReady;
    db = drizzlePglite(pgliteClient, { schema });
    client = pgliteClient;
    console.log(`✓ PGlite connected (local): ${dbPath}`);
  }

  return db;
}

// Close database connection
export async function closeDatabase() {
  if (client) {
    if ('close' in client) {
      await client.close();
    } else if ('end' in client) {
      await client.end();
    }
    client = null;
    db = null;
    console.log("✓ Database closed");
  }
}