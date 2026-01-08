// ============================================================================
// FILE: packages/database/src/migrate.ts
// Database migration script using Drizzle Kit with PGlite/PostgreSQL
// ============================================================================

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import fs from 'node:fs';

async function runMigrations() {
  const migrationsFolder = path.join(import.meta.dirname, 'migrations');
  
  console.log('🔄 Running migrations...');
  console.log(`📁 Migrations folder: ${migrationsFolder}`);
  
  // Check if migrations folder exists
  if (!fs.existsSync(migrationsFolder)) {
    console.log('ℹ️  No migrations folder found. Run `bun db:generate` first.');
    process.exit(0);
  }

  try {
    if (process.env.DATABASE_URL) {
      // Use PostgreSQL
      console.log('🐘 Using PostgreSQL');
      const client = postgres(process.env.DATABASE_URL);
      const db = drizzlePostgres(client);
      
      await migratePostgres(db, { migrationsFolder });
      await client.end();
    } else {
      // Use PGlite for local development
      const dbPath = process.env.PGLITE_PATH || path.join(process.cwd(), 'data', 'credopass');
      console.log(`📦 Using PGlite: ${dbPath}`);
      
      // Ensure the data directory exists
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const pglite = new PGlite(dbPath);
      await pglite.waitReady;
      
      const db = drizzlePglite(pglite);
      await migratePglite(db, { migrationsFolder });
      await pglite.close();
    }
    
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
