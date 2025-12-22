// ============================================================================
// FILE: server/db/migrate.ts
// Database migration script using Drizzle Kit with PGlite
// ============================================================================

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import fs from 'node:fs';

async function runMigrations() {
  const dbPath = path.join(process.cwd(), 'data', 'dwellpass');
  
  console.log('🔄 Running migrations...');
  console.log(`📁 Database: ${dbPath}`);
  
  // Ensure the data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const pglite = new PGlite(dbPath);
  await pglite.waitReady;
  
  const db = drizzle(pglite);
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pglite.close();
  }
}

runMigrations();
