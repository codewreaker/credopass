// ============================================================================
// FILE: drizzle.config.ts
// Drizzle configuration for migrations and schema management
// ============================================================================

import { defineConfig } from 'drizzle-kit';
console.log(`Drizzle Config - Using`, process.env.DATABASE_URL)

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '', 
  },
  verbose: true,
  strict: true,
});
