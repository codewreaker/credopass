// ============================================================================
// FILE: server/db/index.ts
// SQLite database connection and configuration with Drizzle ORM
// ============================================================================
import path from "node:path";
import * as schema from './schema.js';
// import { type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { isBun } from "std-env";

let drizzle: any;
let Database: any;

if (isBun) {
  // Use Bun's native SQLite
  const bunSqlite = await import('drizzle-orm/bun-sqlite');
  drizzle = bunSqlite.drizzle;
  const bunDb = await import('bun:sqlite');
  Database = bunDb.Database;
} else {
  // Use better-sqlite3 for Node.js (Vercel)
  const betterSqlite = await import('drizzle-orm/better-sqlite3');
  drizzle = betterSqlite.drizzle;
  const sqlite3 = await import('better-sqlite3');
  Database = sqlite3.default;
}

// Export schema
export * from './schema.js';

// Singleton database instance
let db: any = null;
let client: any = null;

// Singleton client getter
function getClient(dbPath: string = path.join(process.cwd(), "data", "dwellpass.db")) {
  if (!client) {
    if (isBun) {
      client = new Database(dbPath, {
        create: false,
        strict: true,
      });
    } else {
      client = new Database(dbPath);
    }

    // Enable WAL mode for better concurrent performance
    if (isBun) {
      client.run("PRAGMA journal_mode = WAL;");
      client.run("PRAGMA synchronous = NORMAL;");
      client.run("PRAGMA cache_size = -64000;"); // 64MB cache
      client.run("PRAGMA temp_store = MEMORY;");
      client.run("PRAGMA foreign_keys = ON;");
    } else {
      client.pragma("journal_mode = WAL");
      client.pragma("synchronous = NORMAL");
      client.pragma("cache_size = -64000");
      client.pragma("temp_store = MEMORY");
      client.pragma("foreign_keys = ON");
    }
    
    console.log(`✓ Database connected (${isBun ? 'Bun' : 'Node.js'}): ${dbPath}`);
  }

  return client;
}

// Get Drizzle database instance
export function getDatabase() {
  if (!db) {
    const sqliteClient = getClient();
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