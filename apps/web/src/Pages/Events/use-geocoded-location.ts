import { useEffect, useState } from 'react';
import { MAPBOX_ACCESS_TOKEN } from '../../config';

export interface GeocodedPlace {
  lng: number;
  lat: number;
}

export type GeocodeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; place: GeocodedPlace }
  | { status: 'notfound' }
  | { status: 'error' };

/**
 * Module-level cache, keyed by the raw address string.
 *
 * Events store their location as free text, so the same address is looked up
 * again on every remount and for every event sharing a venue. Mapbox bills per
 * request and the answer for a given string doesn't change within a session, so
 * caching here is both cheaper and faster. A `null` value is a cached "no such
 * place". Cleared on reload, which is fine.
 */
const cache = new Map<string, GeocodedPlace | null>();

/** Address strings that clearly aren't places — don't waste a lookup on them. */
const isGeocodable = (address: string) => {
  const trimmed = address.trim();
  if (trimmed.length < 3) return false;
  // A URL is a perfectly valid event location ("offline location or virtual
  // link"), just not a geocodable one.
  return !/^(https?:\/\/|www\.)/i.test(trimmed);
};

/**
 * Forward-geocode an event's free-text location into coordinates.
 *
 * Events carry no lat/lng columns, so the map has to resolve the address at read
 * time. Returns an explicit state, letting callers tell "still looking" apart
 * from "no such place" instead of silently rendering an arbitrary map.
 *
 * The result is *derived* during render from the cache rather than mirrored into
 * state: the effect's only job is the network call, so there is no synchronous
 * setState to cascade a re-render.
 */
export function useGeocodedLocation(address: string | null | undefined): GeocodeState {
  const query = (address ?? '').trim();
  const enabled = query.length > 0 && isGeocodable(query) && Boolean(MAPBOX_ACCESS_TOKEN);

  // The counter's value is never read — bumping it is just how we re-render once a
  // lookup has populated the cache. `failedQuery` records which address failed, so
  // a later address starts clean.
  const [, setVersion] = useState(0);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || cache.has(query)) return;

    const controller = new AbortController();
    const url =
      `https://api.mapbox.com/search/geocode/v6/forward` +
      `?q=${encodeURIComponent(query)}&limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status})`);
        const data = await res.json();
        const coords = data?.features?.[0]?.geometry?.coordinates;
        const place: GeocodedPlace | null =
          Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number'
            ? { lng: coords[0], lat: coords[1] }
            : null;

        cache.set(query, place);
        if (!controller.signal.aborted) setVersion((v) => v + 1);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return;
        // Deliberately not cached — a network blip shouldn't poison this address
        // for the rest of the session.
        console.error('[useGeocodedLocation] lookup failed', error);
        setFailedQuery(query);
      });

    return () => controller.abort();
    // `version` is intentionally absent: it is an output of this effect, and
    // including it would re-run the lookup on its own result.
  }, [query, enabled]);

  if (!enabled) return { status: 'idle' };
  if (failedQuery === query) return { status: 'error' };

  if (cache.has(query)) {
    const hit = cache.get(query) ?? null;
    return hit ? { status: 'ready', place: hit } : { status: 'notfound' };
  }

  return { status: 'loading' };
}
