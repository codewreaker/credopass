/**
 * The paired-device credential.
 *
 * A door tablet holds a `cpd_…` device token and **nothing else** — no account,
 * no organization session, no way to read the console. It is issued once, by
 * `POST /devices/pair`, and there is no endpoint that will hand it over again,
 * so it has to be persisted the moment it arrives.
 *
 * The token wins over any Supabase session when both are present. A tablet that
 * has been paired is a tablet; the staff browser at the same event never pairs,
 * so the two modes cannot collide in practice, and preferring the token means a
 * stale guest session left over from someone testing the URL cannot silently
 * downgrade a door back into account mode.
 */

const STORAGE_KEY = 'credopass:device-token';

export interface DeviceCredential {
  token: string;
  deviceId: string;
  label: string;
  /** The one event this device may record attendance for. */
  eventId: string | null;
  organizationId: string;
  scopes: string[];
  expiresAt: string;
}

export function readDeviceCredential(): DeviceCredential | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceCredential;
    return typeof parsed?.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function storeDeviceCredential(credential: DeviceCredential): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
  } catch {
    /* Storage unavailable — pairing still works for this session only. */
  }
}

/**
 * Forget the device. Called when the console revokes it: the tablet gets
 * `401 token_revoked` and must be re-paired, not bounced to a sign-in form.
 */
export function clearDeviceCredential(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function getDeviceToken(): string | null {
  return readDeviceCredential()?.token ?? null;
}
