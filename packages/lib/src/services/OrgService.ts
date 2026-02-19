/**
 * Organization Service
 * Orchestration layer for organization operations
 * Coordinates between OrganizationModel and related models
 */

import { createOrganization, getOrganizationById } from '../models/OrganizationModel';
import type { Organization, OrgMembership, User } from '../schemas';
import { getCollections } from '@credopass/api-client/collections';

/**
 * Create organization with owner
 * Creates an organization and sets up the owner membership
 */
export async function createOrgWithOwner(
  orgData: Partial<Organization>,
  ownerId: string
): Promise<{
  organization: Organization;
  membership: OrgMembership;
}> {
  // Create the organization
  const organization = await createOrganization(orgData);
  
  // Create owner membership
  const collections = getCollections();
  const membership = await collections.orgMemberships.insert({
    organizationId: organization.id,
    userId: ownerId,
    role: 'owner',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OrgMembership);
  
  return { organization, membership };
}

/**
 * Get organization with members
 * Fetches organization and all member relationships
 */
export async function getOrgWithMembers(organizationId: string): Promise<{
  organization: Organization | undefined;
  memberships: OrgMembership[];
  members: User[];
}> {
  const organization = await getOrganizationById(organizationId);
  
  const collections = getCollections();
  const allMemberships = await collections.orgMemberships.findAll();
  const memberships = allMemberships.filter(m => m.organizationId === organizationId);
  
  // Fetch all members
  const members: User[] = [];
  for (const membership of memberships) {
    const user = await collections.users.findById(membership.userId);
    if (user) members.push(user);
  }
  
  return { organization, memberships, members };
}
