// ============================================================================
// FILE: packages/database/src/index.ts
// Main entry point for @credopass/database package
// ============================================================================

// Export all schema definitions
export * from './schema';

// Export database client utilities
export {
  createPostgresClient,
  getDatabase,
  closeDatabase,
  isDBConnected,
  type Database
} from './client';
