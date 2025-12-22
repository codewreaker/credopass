// ============================================================================
// FILE: drizzle.config.ts
// Drizzle configuration for migrations and schema management (PGlite/PostgreSQL)
// ============================================================================

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: {
    url: './data/dwellpass',
  },
  verbose: true,
  strict: true,
});
