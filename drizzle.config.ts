// ============================================================================
// FILE: drizzle.config.ts
// Drizzle configuration for migrations and schema management
// ============================================================================

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'turso',
  dbCredentials: {
    url: 'file:data/dwellpass.db',
  },
  verbose: true,
  strict: true,
});
