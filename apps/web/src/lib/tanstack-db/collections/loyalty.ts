// ============================================================================
// FILE: packages/tanstack-db/src/collections/loyalty.ts
// TanStack DB collection for Loyalty
// ============================================================================

import { createCollection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { Loyalty } from '@credopass/validation';

const API_BASE = '/api';

/**
 * Create loyalty collection with a specific QueryClient
 */
export function createLoyaltyCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: ['loyalty'],
      queryFn: async (): Promise<Loyalty[]> => {
        const response = await fetch(`${API_BASE}/loyalty`);
        if (!response.ok) throw new Error('Failed to fetch loyalty records');
        const data = await response.json();
        // Transform dates from the API response
        return data.map((record: Loyalty) => ({
          ...record,
          issuedAt: new Date(record.issuedAt),
          expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        }));
      },
      getKey: (item) => item.id,
      queryClient,

      // Handle INSERT
      onInsert: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { modified: newRecord } = mutation;
        const response = await fetch(`${API_BASE}/loyalty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecord),
        });
        if (!response.ok) throw new Error('Failed to create loyalty record');
      },

      // Handle UPDATE
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original, modified } = mutation;
        const response = await fetch(`${API_BASE}/loyalty/${original.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modified),
        });
        if (!response.ok) throw new Error('Failed to update loyalty record');
      },

      // Handle DELETE
      onDelete: async ({ transaction }) => {
        const mutation = transaction.mutations[0];
        if (!mutation) return;
        const { original } = mutation;
        const response = await fetch(`${API_BASE}/loyalty/${original.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete loyalty record');
      },
    })
  );
}

export type LoyaltyCollection = ReturnType<typeof createLoyaltyCollection>;
