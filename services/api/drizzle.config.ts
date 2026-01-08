// ============================================================================
// FILE: drizzle.config.ts
// Drizzle configuration for migrations and schema management
// ============================================================================

import { defineConfig } from 'drizzle-kit';
import { isEdgeLight, isWorkerd, isNetlify } from 'std-env';

const isHosted = isEdgeLight || isWorkerd || isNetlify;

console.log(`Drizzle Config - Using`, process.env.DATABASE_URL)

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
   ...(!(isHosted && process.env.DATABASE_URL) && { driver: 'pglite' }),
  dbCredentials: {
    url: isHosted && process.env.DATABASE_URL 
      ? process.env.DATABASE_URL 
      : '../../data/credopass',
  },
  verbose: true,
  strict: true,
});
