// ============================================================================
// FILE: packages/api-client/src/collections/organizations.ts
// TanStack DB collection for Organizations
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { Organization } from '@credopass/lib/schemas';
import { API_BASE_URL, handleAPIErrors } from '../client';

/**
 * Create organization collection with a specific QueryClient
 */
export function createOrganizationCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['organizations'],
      queryFn: async (): Promise<Array<Organization>> => {
        const response = await fetch(`${API_BASE_URL}/organizations`);
        if (!response.ok) throw new Error('Failed to fetch organizations');
        const data = await response.json();
        return data.map((org: Organization) => ({
          ...org,
          createdAt: new Date(org.createdAt),
          updatedAt: new Date(org.updatedAt),
          deletedAt: org.deletedAt ? new Date(org.deletedAt) : null
        }));
      },
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newOrg } = mutation;
        const response = await fetch(`${API_BASE_URL}/organizations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrg),
        });
        await handleAPIErrors(response);
        return response.json();
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${API_BASE_URL}/organizations/${original.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modified),
        });
        if (!response.ok) throw new Error('Failed to update organization');
      },

      // Handle DELETE
      onDelete: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original } = mutation;
        const response = await fetch(`${API_BASE_URL}/organizations/${original.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete organization');
      },
    })
  );
}

export type OrganizationCollection = ReturnType<typeof createOrganizationCollection>;
