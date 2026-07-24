// ============================================================================
// FILE: packages/api-client/src/collections/persisted-ids.ts
// Bridging client-generated optimistic ids to the ids the API actually assigns
// ============================================================================

/**
 * The REST API mints its own id on create. The `Create*Schema`s omit `id`, so
 * zod strips the client-generated uuid out of the request body and the CRUD
 * factory generates a fresh one server-side. That means the optimistic row we
 * inserted is keyed differently to the row that arrives on the next refetch, and
 * anything still holding the client id — a redirect to `/events/$eventId`, or a
 * foreign key we are about to write — points at a row that will never exist.
 *
 * Collections record the mapping as their inserts land; callers resolve it once
 * the transaction has persisted.
 */

type CollectionName = 'events' | 'users' | 'eventMembers' | 'attendance';

const registry = new Map<string, string>();
const MAX_TRACKED_INSERTS = 50;

const keyFor = (collection: CollectionName, optimisticId: string) =>
  `${collection}:${optimisticId}`;

/** Called from a collection's `onInsert` once the server has responded. */
export const rememberPersistedId = (
  collection: CollectionName,
  optimisticId: string | undefined,
  serverId: string | undefined
): void => {
  if (!optimisticId || !serverId || optimisticId === serverId) return;

  registry.set(keyFor(collection, optimisticId), serverId);

  // Keep the map from growing across a long session — Map preserves insertion
  // order, so the first key is always the oldest.
  while (registry.size > MAX_TRACKED_INSERTS) {
    const oldest = registry.keys().next().value;
    if (oldest === undefined) break;
    registry.delete(oldest);
  }
};

/**
 * Resolve the id the server actually persisted. Falls back to the id passed in,
 * so it is safe to call for rows that were not created in this session.
 */
export const resolvePersistedId = (
  collection: CollectionName,
  optimisticId: string
): string => registry.get(keyFor(collection, optimisticId)) ?? optimisticId;

/** Resolve the real id of an event that was just created client-side. */
export const resolvePersistedEventId = (optimisticId: string): string =>
  resolvePersistedId('events', optimisticId);

/** Resolve the real id of a user that was just created client-side. */
export const resolvePersistedUserId = (optimisticId: string): string =>
  resolvePersistedId('users', optimisticId);
