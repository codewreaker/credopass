// ============================================================================
// FILE: packages/database/drizzle.config.ts
// Drizzle configuration for migrations and schema management
// ============================================================================

import { defineConfig } from 'drizzle-kit';
import { isEdgeLight, isWorkerd, isNetlify } from 'std-env';

const isHosted = isEdgeLight || isWorkerd || isNetlify;

console.log('Drizzle Config - Using:', process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite');

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  ...(!process.env.DATABASE_URL && { driver: 'pglite' }),
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/dwellpass',
  },
  verbose: true,
  strict: true,
});
