// ============================================================================
// FILE: packages/lib/src/schemas/org-membership.schema.ts
// Organization membership validation schemas
// ============================================================================

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { orgMemberships } from './tables/org-memberships';
import { z } from 'zod';
import { OrgRoleEnum } from './enums';

// Base membership schema (SELECT from database)
export const OrgMembershipSchema = createSelectSchema(orgMemberships, {
  role: OrgRoleEnum,
});

// Schema for creating a new membership (invite user to org)
export const CreateOrgMembershipSchema = createInsertSchema(orgMemberships, {
  role: OrgRoleEnum,
}).omit({
  // `acceptedAt` is gone: an invitation to someone who has no account yet cannot
  // be a membership row, so invitations live in their own table now.
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for updating a membership (change role)
export const UpdateOrgMembershipSchema = z.object({
  role: OrgRoleEnum.optional(),
});

// Schema for accepting an invitation. The token is the credential — there is no
// membership row to point at until it has been accepted.
export const AcceptInvitationSchema = z.object({
  token: z.string().min(16),
});

// Schema for inserting membership (with optional id for upserts)
export const InsertOrgMembershipSchema = createInsertSchema(orgMemberships, {
  role: OrgRoleEnum,
});

// TypeScript types inferred from Zod schemas
export type OrgMembership = z.infer<typeof OrgMembershipSchema>;
export type CreateOrgMembership = z.infer<typeof CreateOrgMembershipSchema>;
export type UpdateOrgMembership = z.infer<typeof UpdateOrgMembershipSchema>;
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;
export type InsertOrgMembership = z.infer<typeof InsertOrgMembershipSchema>;

// Select schema (for query results)
export const SelectOrgMembershipSchema = OrgMembershipSchema;
export type SelectOrgMembership = OrgMembership;
