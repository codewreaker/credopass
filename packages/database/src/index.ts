// ============================================================================
// FILE: packages/database/src/index.ts
// Main entry point for @dwellpass/database package
// ============================================================================

// Export all schema definitions
export * from './schema';

// Export database client utilities
export {
  createDatabaseClient,
  createPgliteClient,
  getDatabase,
  closeDatabase,
  isDatabaseConnected,
  getConnectionInfo,
  type Database,
  type PgliteDB,
  type PostgresDB,
} from './client';
