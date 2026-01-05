// ============================================================================
// FILE: server/db/index.ts
// PGlite database connection and configuration with Drizzle ORM
// ============================================================================
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import path from "node:path";
import * as schema from './schema';

// Export schema
export * from './schema';

// Singleton database instance
let db: PgliteDatabase<typeof schema> | null = null;
let client: PGlite | null = null;

// Singleton client getter
async function getPGliteClient(dbPath: string = path.join(process.cwd(), "data", "dwellpass")): Promise<PGlite> {
  if (!client) {
    client = new PGlite(dbPath);
    await client.waitReady;
    console.log(`✓ PGlite database connected: ${dbPath}`);
  }

  return client;
}

// Get Drizzle database instance
export async function getDatabase(): Promise<PgliteDatabase<typeof schema>> {
  if (!db) {
    const pgliteClient = await getPGliteClient();
    db = drizzle(pgliteClient, { schema });
  }

  return db;
}

// Close database connection
export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("✓ Database closed");
  }
}