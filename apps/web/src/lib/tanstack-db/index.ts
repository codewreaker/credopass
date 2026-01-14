import { QueryClient } from '@tanstack/query-core';
import { createUserCollection } from './collections/users';
import { createEventCollection } from './collections/events';
import { createAttendanceCollection } from './collections/attendance';
import { createLoyaltyCollection } from './collections/loyalty';


export type CredoPassCollections = {
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
let credoPassInstance: CredoPassCollections | null = null;

/**
 * Get or create a singleton instance of CredoPass collections
 */
export function getCollections(): CredoPassCollections {
    if (!credoPassInstance) {
        const client = new QueryClient();
        credoPassInstance = {
            users: createUserCollection(client),
            events: createEventCollection(client),
            attendance: createAttendanceCollection(client),
            loyalty: createLoyaltyCollection(client),
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

export async function handleAPIErrors(response: Response) {
    if (!response.ok) {
        const { error: { cause } } = await response.json();
        console.error(cause?.stack);
        throw new Error(`${cause?.detail}`);
    };
}