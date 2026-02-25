// ============================================================================
// FILE: packages/api-client/src/collections/index.ts
// Barrel export for all collections
// ============================================================================

import { QueryClient } from '@tanstack/query-core';
import { createUserCollection } from './users';
import { createOrganizationCollection } from './organizations';
import { createEventCollection } from './events';
import { createAttendanceCollection } from './attendance';
import { createLoyaltyCollection } from './loyalty';
import { createOrgMembershipCollection } from './org-memberships';
import { createEventMemberCollection } from './event-members';

export * from './users';
export * from './organizations';
export * from './events';
export * from './event-members';
export * from './org-memberships';
export * from './attendance';
export * from './loyalty';

export type CredoPassCollections = {
  users: ReturnType<typeof createUserCollection>;
  organizations: ReturnType<typeof createOrganizationCollection>;
  events: ReturnType<typeof createEventCollection>;
  attendance: ReturnType<typeof createAttendanceCollection>;
  loyalty: ReturnType<typeof createLoyaltyCollection>;
  orgMemberships: ReturnType<typeof createOrgMembershipCollection>;
  eventMembers: ReturnType<typeof createEventMemberCollection>;
  queryClient: QueryClient;
};

// Singleton instance
let credoPassInstance: CredoPassCollections | null = null;

/**
 * Get or create a singleton instance of CredoPass collections
 */
export function getCollections(): CredoPassCollections {
  if (!credoPassInstance) {
    const client = new QueryClient();
    credoPassInstance = {
      users: createUserCollection(client),
      organizations: createOrganizationCollection(client),
      events: createEventCollection(client),
      attendance: createAttendanceCollection(client),
      loyalty: createLoyaltyCollection(client),
      orgMemberships: createOrgMembershipCollection(client),
      eventMembers: createEventMemberCollection(client),
      queryClient: client,
    };
  }
  return credoPassInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCredoPassCollections(): void {
  credoPassInstance = null;
}

// Type helper to get only collection names (excluding queryClient)
type CollectionName = Exclude<keyof CredoPassCollections, 'queryClient'>;

/**
 * Delete an item from a collection by ID
 * @param collectionName - Name of the collection
 * @param id - ID of the item to delete
 * @param onClose - Optional callback to call after deletion
 */
export async function handleCollectionDeleteById(
  collectionName: CollectionName,
  id: string,
  onClose?: () => void
) {
  const collections = getCollections();
  const collection = collections[collectionName];

  if (!collection) {
    throw new Error(`Collection "${collectionName}" not found`);
  }

  await collection.delete(id);

  if (onClose) {
    onClose();
  }
}
