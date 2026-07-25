// ============================================================================
// FILE: drizzle.config.ts
// Drizzle configuration for migrations and schema management
// ============================================================================

import { defineConfig } from 'drizzle-kit';
// Presence only — the URL carries the DB password, so never print its value.
console.log(`Drizzle Config - DATABASE_URL ${process.env.DATABASE_URL ? '✓' : '✗ missing'}`);

export default defineConfig({
  schema: '../../packages/lib/src/schemas/tables/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '', 
  },
  verbose: true,
  strict: true,
});
