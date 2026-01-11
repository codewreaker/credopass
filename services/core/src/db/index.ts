// ============================================================================
// FILE: services/core/src/db/index.ts
// Main entry point for database package
// ============================================================================

// Export all schema definitions (re-exported from @credopass/lib/schemas)
export * from '@credopass/lib/schemas/tables';

// Export database client utilities
export {
  createPostgresClient,
  getDatabase,
  closeDatabase,
  isDBConnected,
  type Database
} from './client';

