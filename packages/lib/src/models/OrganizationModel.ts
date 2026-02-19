/**
 * Organization Model
 * Pure TypeScript functions for organization operations
 * No React, no JSX - just business logic
 */

import type { Organization } from '../schemas';
import { getCollections } from '@credopass/api-client/collections';

/**
 * Get all organizations
 */
export async function getOrganizations(): Promise<Organization[]> {
  const collections = getCollections();
  return collections.organizations.findAll();
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(id: string): Promise<Organization | undefined> {
  const collections = getCollections();
  return collections.organizations.findById(id);
}

/**
 * Create a new organization
 */
export async function createOrganization(orgData: Partial<Organization>): Promise<Organization> {
  const collections = getCollections();
  return collections.organizations.insert(orgData as Organization);
}

/**
 * Switch active organization
 * This is typically handled by the OrganizationStore, but included here for completeness
 */
export async function switchOrganization(organizationId: string): Promise<Organization | undefined> {
  return getOrganizationById(organizationId);
}
