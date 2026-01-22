// ============================================================================
// FILE: packages/lib/src/schemas/index.ts
// Barrel export for all validation schemas and database tables
// ============================================================================

// Drizzle tables and relations
export * from './tables';

// Enums
export * from './enums';

// User schemas
export * from './user.schema';

// Organization schemas (multi-tenancy)
export * from './organization.schema';

// Organization membership schemas
export * from './org-membership.schema';

// Event schemas
export * from './event.schema';

// Event member schemas (replaces hostId)
export * from './event-member.schema';

// Attendance schemas
export * from './attendance.schema';

// Loyalty schemas
export * from './loyalty.schema';

