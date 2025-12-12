// ============================================================================
// FILE: server/db/index.ts
// SQLite database connection and configuration with Drizzle ORM
// ============================================================================
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { Database } from "bun:sqlite";
import path from "node:path";
import * as schema from './schema';

// Export schema
export * from './schema';

// Singleton database instance
let db: BunSQLiteDatabase<typeof schema> | null = null;
let client: Database | null = null;

// Singleton client getter
function getBunClient(dbPath: string = path.join(process.cwd(), "data", "dwellpass.db")): Database {
  if (!client) {
    client = new Database(dbPath, {
      create: true,
      strict: true, // Better error handling for missing params
    });

    // Enable WAL mode for better concurrent performance
    client.run("PRAGMA journal_mode = WAL;");

    // Other performance optimizations
    client.run("PRAGMA synchronous = NORMAL;");
    client.run("PRAGMA cache_size = -64000;"); // 64MB cache
    client.run("PRAGMA temp_store = MEMORY;");
    client.run("PRAGMA foreign_keys = ON;"); // Enable foreign key constraints
    console.log(`✓ Database connected: ${dbPath}`);
  }

  return client;
}

// Get Drizzle database instance
export function getDatabase(): BunSQLiteDatabase<typeof schema> {
  if (!db) {
    const sqliteClient = getBunClient();
    db = drizzle(sqliteClient, { schema });
  }

  return db;
}

// Close database connection
export function closeDatabase() {
  if (client) {
    client.close();
    client = null;
    db = null;
    console.log("✓ Database closed");
  }
}