// ============================================================================
// FILE: packages/tanstack-db/src/db-instance.ts
// TanStack DB instance setup
// ============================================================================

import { QueryClient } from '@tanstack/query-core';
import { createUserCollection } from './collections/users';
import { createEventCollection } from './collections/events';
import { createAttendanceCollection } from './collections/attendance';
import { createLoyaltyCollection } from './collections/loyalty';

/**
 * Create DwellPass collections with a specific QueryClient
 * Note: TanStack DB doesn't have a createDB function, so we return collections directly
 */
export function createDwellPassCollections(client: QueryClient): DwellPassCollections {
    return {
        users: createUserCollection(client),
        events: createEventCollection(client),
        attendance: createAttendanceCollection(client),
        loyalty: createLoyaltyCollection(client),
        queryClient: client,
    };
}

export type DwellPassCollections = {
    users: ReturnType<typeof createUserCollection>;
    events: ReturnType<typeof createEventCollection>;
    attendance: ReturnType<typeof createAttendanceCollection>;
    loyalty: ReturnType<typeof createLoyaltyCollection>;
    queryClient: QueryClient;
};


// Export collections
export {
    createUserCollection,
    createEventCollection,
    createAttendanceCollection,
    createLoyaltyCollection
} from './collections';


// Singleton instance
let dwellPassInstance: DwellPassCollections | null = null;

/**
 * Get or create a singleton instance of DwellPass collections
 */
export function getCollections(): DwellPassCollections {
    if (!dwellPassInstance) {
        const client = new QueryClient();
        dwellPassInstance = createDwellPassCollections(client);
    }
    return dwellPassInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetDwellPassCollections(): void {
    dwellPassInstance = null;
}