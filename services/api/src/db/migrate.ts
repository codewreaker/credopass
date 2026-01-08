// ============================================================================
// FILE: packages/database/src/migrate.ts
// Database migration script using Drizzle Kit with PGlite/PostgreSQL
// ============================================================================
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';

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
      const db = drizzlePostgres(process.env.DATABASE_URL);
      const client = db.$client;

      await migratePostgres(db, { migrationsFolder });
      await client.end();
      console.log('✅ Migrations completed successfully!');
    }else {
      throw new Error('❌ DATABASE_URL is not set. Cannot run migrations.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
