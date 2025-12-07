// ============================================================================
// FILE: src/server/db/index.ts
// SQLite database connection and configuration
// ============================================================================

import { Database } from "bun:sqlite";
import path from "node:path";

export { default as UserOperations } from './user'

// Singleton database instance
let db: Database | null = null;

export function getDatabase(): Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), "data", "dwellpass.db");

    db = new Database(dbPath, {
      create: true,
      strict: true, // Better error handling for missing params
    });

    // Enable WAL mode for better concurrent performance
    db.run("PRAGMA journal_mode = WAL;");

    // Other performance optimizations
    db.run("PRAGMA synchronous = NORMAL;");
    db.run("PRAGMA cache_size = -64000;"); // 64MB cache
    db.run("PRAGMA temp_store = MEMORY;");

    console.log(`✓ Database connected: ${dbPath}`);
  }

  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log("✓ Database closed");
  }
}

// ============================================================================
// FILE: src/server/db/schema.ts
// Database schema and migrations
// ============================================================================


export function initializeSchema(db: Database) {
  try {
    // Users table
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      phone TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

    // Indexes for better query performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_createdAt ON users(createdAt)`);

    console.log("✓ Database schema initialized");
  } catch (error) {
    console.error("❌ Failed to initialize schema:", error);
    throw error;
  }
}