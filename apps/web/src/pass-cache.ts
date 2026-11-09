/**
 * The pass token you were last issued, on this device.
 *
 * **Why a cache exists at all.** Only the SHA-256 of a pass token is stored
 * server-side, so there is no "fetch my pass" — the honest operation is to mint
 * a new one, and minting REVOKES the previous (`uq_passes_event_person_live`
 * allows exactly one live pass per person per event). That is right for storage
 * and wrong for "show me my QR again": reopening your own ticket should not
 * invalidate the link already sitting in your messages.
 *
 * So the device keeps the token it was handed. That is not a weakening: the
 * token was already in this person's hands the moment it was issued, and the
 * Supabase session — which is their whole account — already lives in the same
 * localStorage. A pass is a bearer credential for one person at one event;
 * beside the session it is the smaller prize by a wide margin. IndexedDB would
 * be identical on this axis and is only worth reaching for if the budget ever
 * runs out, which one token per event will not do.
 *
 * **It is a hint, never the truth.** The entry goes stale whenever the pass is
 * reissued on another device, expires, or the organiser removes the person from
 * the roll — and the device cannot know. So nothing here may render a QR on its
 * own: the pass screen still calls `GET /p/{token}` and only draws what the
 * server confirms. A revoked pass that still painted would send somebody to a
 * door with a code that will not scan, which is worse than a spinner.
 *
 * `eventForToken` is the recovery path. When the pass screen is told a token is
 * gone, it needs to know which event to reissue for — and the public URL is
 * `/p/{token}` with nothing else in it, deliberately. Rather than widen that
 * URL, the lookup runs backwards through this map.
 */

const STORAGE_KEY = 'credopass:passes';

interface Entry {
  token: string;
  /** ISO. Past this, the token is known-dead without asking the server. */
  expiresAt: string;
}

type Store = Record<string, Entry>;

const read = (): Store => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    // Private window, blocked storage, or something that is not JSON. An empty
    // cache is the safe failure: every path falls back to reissuing.
    return {};
  }
};

const write = (store: Store): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* nothing to remember it in; the next open reissues, which still works */
  }
};

/** The live token for this event, or null. Expired entries are swept on read. */
export function getCachedPass(eventId: string): Entry | null {
  const store = read();
  const entry = store[eventId];
  if (!entry?.token) return null;

  if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) {
    delete store[eventId];
    write(store);
    return null;
  }
  return entry;
}

export function rememberPass(eventId: string, token: string, expiresAt: string): void {
  const store = read();
  store[eventId] = { token, expiresAt };
  write(store);
}

export function forgetPass(eventId: string): void {
  const store = read();
  if (!(eventId in store)) return;
  delete store[eventId];
  write(store);
}

/**
 * Which event a token belongs to, by searching backwards.
 *
 * Only ever finds tokens THIS device was issued, which is the point: a link
 * somebody else sent you is not yours to reissue, and returning null there is
 * what makes the pass screen show "ask the organiser" rather than silently
 * minting a pass against a stranger's ticket.
 */
export function eventForToken(token: string): string | null {
  const store = read();
  for (const [eventId, entry] of Object.entries(store)) {
    if (entry?.token === token) return eventId;
  }
  return null;
}
