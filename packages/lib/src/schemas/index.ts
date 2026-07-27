// ============================================================================
// FILE: packages/lib/src/schemas/index.ts
// Barrel export for the Drizzle tables, the shared enums and the auth form
// schemas. The per-table *.schema.ts validators are gone: request validation
// lives in the OpenAPI contract now, and a second copy could only disagree.
// ============================================================================

// Drizzle tables and relations
export * from './tables';

// Enums
export * from './enums';

// email from schemas
export * from './email.schemas'

