// ============================================================================
// FILE: server/db/migrate.ts
// Database migration script using Drizzle Kit
// ============================================================================

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import path from 'node:path';

async function runMigrations() {
  const dbPath = path.join(process.cwd(), 'data', 'dwellpass.db');
  
  console.log('🔄 Running migrations...');
  console.log(`📁 Database: ${dbPath}`);
  
  const sqlite = new Database(dbPath, { create: true });
  
  // Enable foreign keys
  sqlite.run("PRAGMA foreign_keys = ON;");
  
  const db = drizzle(sqlite);
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

runMigrations();
