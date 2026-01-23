// ============================================================================
// FILE: packages/tanstack-db/src/collections/org-memberships.ts
// TanStack DB collection for Organization Memberships
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { OrgMembership } from '@credopass/lib/schemas';
import { API_BASE_URL } from '../../../config';
import { handleAPIErrors } from '..';

/**
 * Create organization memberships collection with a specific QueryClient
 */
export function createOrgMembershipCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['org-memberships'],
      queryFn: async (): Promise<OrgMembership[]> => {
        try {
          const response = await fetch(`${API_BASE_URL}/org-memberships`);
          const data = await response.json();
          // Transform dates from the API response
          return data.map((record: OrgMembership) => ({
            ...record,
            invitedAt: record.invitedAt ? new Date(record.invitedAt) : null,
            acceptedAt: record.acceptedAt ? new Date(record.acceptedAt) : null,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          }));
        } catch (error) {
          throw `An error occurred while fetching org memberships: ${String(error)}. Please ensure the API server is running and accessible.`;
        }
      },
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newRecord } = mutation;
        const response = await fetch(`${API_BASE_URL}/org-memberships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecord),
        });
        await handleAPIErrors(response);
        return response.json();
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${API_BASE_URL}/org-memberships/${original.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modified),
        });
        if (!response.ok) throw new Error('Failed to update org membership');
      },

      // Handle DELETE
      onDelete: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original } = mutation;
        const response = await fetch(`${API_BASE_URL}/org-memberships/${original.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete org membership');
      },
    })
  );
}

export type OrgMembershipCollection = ReturnType<typeof createOrgMembershipCollection>;
