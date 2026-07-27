/**
 * @credopass/api-client — the only way apps reach the API.
 *
 * Apps never call `fetch` for app data. Import a hook and let the generated
 * types check the call:
 *
 *   const { data } = useEvents({ group: 'upcoming' });
 *
 * Three layers, in order of how often you should reach for them:
 *
 *   hooks/       TanStack Query hooks, one per endpoint group — start here
 *   client.ts    the typed openapi-fetch client, for anything a hook doesn't cover
 *   generated/   openapi-typescript output, regenerated from the service
 *
 * TanStack **DB** collections are gone and are not coming back. The server
 * decides; the client renders (API-SECOND-REBUILD §1.2).
 */

export * from './client';
export * from './types';
export * from './query-keys';
export * from './active-organization';
export * from './hooks';
