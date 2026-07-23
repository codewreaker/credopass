// ============================================================================
// FILE: packages/api-client/src/collections/supabase-collection.ts
// Thin wrapper over `supabaseCollectionOptions` that coerces timestamp columns
// back into `Date` objects on the *read* path.
// ----------------------------------------------------------------------------
// Why this exists: PostgREST returns timestamps as ISO strings. TanStack DB
// validates the rows produced by inserts/updates and Realtime against the
// collection schema (so `z.coerce.date()` handles those), but the initial query
// sync writes fetched rows straight through *without* running the schema. That
// left `startTime`, `createdAt`, … as strings on first paint, breaking any
// consumer that calls `Date` methods directly (e.g. `event.startTime.getTime()`).
//
// The collection's sync receives the `write` function it uses to push rows into
// the store; wrapping it lets us coerce the configured date columns on every
// synced row, so collection rows always expose real `Date` instances — matching
// the previous drizzle/REST behaviour.
// ============================================================================

import { supabaseCollectionOptions } from '@supabase-labs/tanstack-db';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/query-core';

// Mirrors `SupabaseCollectionOptions` from the adapter (which is not exported),
// plus the extra `dateFields` this wrapper needs. Kept generic over the schema
// so `keys` and the returned collection config stay fully type-inferred.
export interface SupabaseCollectionWithDatesOptions<TSchema extends StandardSchemaV1> {
  /** The name of the table in the database. */
  tableName: string;
  /** The schema of a single row. */
  schema: TSchema;
  /** The column(s) that uniquely identify a row. */
  keys: Array<keyof StandardSchemaV1.InferOutput<TSchema> & string>;
  /** The Supabase browser client. */
  supabase: SupabaseClient;
  /** Optional TanStack Query client. */
  queryClient?: QueryClient;
  /** Subscribe to Postgres changes and reconcile them into the collection. */
  realtime?: boolean;
  /** Timestamp columns to coerce from ISO strings into `Date` objects on read. */
  dateFields: ReadonlyArray<string>;
}

const coerceRow = (row: unknown, dateFields: ReadonlyArray<string>): unknown => {
  if (!row || typeof row !== 'object') return row;
  const source = row as Record<string, unknown>;
  let next: Record<string, unknown> | undefined;
  for (const field of dateFields) {
    const value = source[field];
    if (typeof value === 'string' && value.length > 0) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        next ??= { ...source };
        next[field] = date;
      }
    }
  }
  return next ?? row;
};

export function supabaseCollectionOptionsWithDates<TSchema extends StandardSchemaV1>({
  dateFields,
  ...options
}: SupabaseCollectionWithDatesOptions<TSchema>): ReturnType<
  typeof supabaseCollectionOptions<TSchema>
> {
  const config = supabaseCollectionOptions<TSchema>(options);
  const originalSync = config.sync.sync;

  type SyncParams = Parameters<typeof originalSync>[0];
  type WriteMessage = Parameters<SyncParams['write']>[0];

  return {
    ...config,
    sync: {
      ...config.sync,
      sync: (params: SyncParams) => {
        const wrappedWrite = (message: WriteMessage) => {
          // Only insert/update messages carry a row value to coerce.
          if (message && 'value' in message && message.value != null) {
            return params.write({
              ...message,
              value: coerceRow(message.value, dateFields),
            } as WriteMessage);
          }
          return params.write(message);
        };
        return originalSync({ ...params, write: wrappedWrite });
      },
    },
  };
}
