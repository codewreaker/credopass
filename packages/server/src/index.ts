// ============================================================================
// FILE: packages/server/src/index.ts
// Main entry point for @dwellpass/server package
// Exports database and API client utilities
// ============================================================================

// Database exports
export * from './db/schema';
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
} from './db/client';

// API Client exports
export {
  ApiError,
  type ApiClient,
  type ApiClientConfig,
  createDwellPassClient,
  getApiClient,
  type DwellPassClient,
} from './api';
export * from './api/endpoints';
