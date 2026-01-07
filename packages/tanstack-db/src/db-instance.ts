// ============================================================================
// FILE: packages/tanstack-db/src/db-instance.ts
// TanStack DB instance setup
// ============================================================================

import { createDB } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { createUserCollection } from './collections/users';
import { createEventCollection } from './collections/events';
import { createAttendanceCollection } from './collections/attendance';
import { createLoyaltyCollection } from './collections/loyalty';

/**
 * Create a TanStack DB instance with all collections
 */
export function createDwellPassDB(queryClient?: QueryClient) {
  const client = queryClient || new QueryClient();

  const db = createDB({
    collections: {
      users: createUserCollection(client),
      events: createEventCollection(client),
      attendance: createAttendanceCollection(client),
      loyalty: createLoyaltyCollection(client),
    },
  });

  return { db, queryClient: client };
}

export type DwellPassDB = ReturnType<typeof createDwellPassDB>['db'];
