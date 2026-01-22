// ============================================================================
// FILE: packages/lib/src/schemas/organization.schema.ts
// Organization validation schemas generated from Drizzle table definitions
// ============================================================================

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { organizations } from './tables/organizations';
import { z } from 'zod';
import { OrgPlanEnum } from './enums';

// Base organization schema (SELECT from database)
export const OrganizationSchema = createSelectSchema(organizations, {
  plan: OrgPlanEnum,
});

// Schema for creating a new organization
export const CreateOrganizationSchema = createInsertSchema(organizations, {
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  plan: OrgPlanEnum,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
});

// Schema for updating an organization
export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

// Schema for inserting an organization (with optional id/timestamps for upserts)
export const InsertOrganizationSchema = createInsertSchema(organizations, {
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  plan: OrgPlanEnum,
});

// TypeScript types inferred from Zod schemas
export type Organization = z.infer<typeof OrganizationSchema>;
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;
export type InsertOrganization = z.infer<typeof InsertOrganizationSchema>;

// Select schema (for query results)
export const SelectOrganizationSchema = OrganizationSchema;
export type SelectOrganization = Organization;
