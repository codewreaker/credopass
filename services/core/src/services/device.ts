/**
 * DeviceService — scoped credentials for door tablets.
 * docs/API-FIRST-REBUILD.md §4, D9, §5.7
 *
 * The problem being solved: a tablet propped by a door held the same credential
 * as the owner's laptop, because the kiosk ran inside the authenticated
 * console. Anyone who walked off with it had the whole organisation.
 *
 * A device token names one event, carries an explicit scope list, expires, and
 * is revocable from the console without disturbing any human's sign-in.
 *
 * No framework imports (rule 3).
 */

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { deviceTokens, events } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import { ProblemCode, ProblemError, problem } from '../http/problem';
import { PERMISSIONS, type Permission } from '../authz/permissions';

/** Distinguishes a device token from a JWT at a glance, in logs and in code. */
export const DEVICE_TOKEN_PREFIX = 'cpd_';

/**
 * Pairing codes are read aloud and typed on a tablet keyboard, so the alphabet
 * omits everything confusable: no 0/O, no 1/I/L, no 5/S, no 8/B.
 */
const CODE_ALPHABET = '234679ACDEFGHJKMNPQRTUVWXYZ';
const CODE_LENGTH = 8;
const PAIRING_TTL_MS = 15 * 60 * 1000;

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

const newPairingCode = (): string =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** What a door tablet needs, and nothing more. */
export const DEFAULT_SCOPES: Permission[] = ['attendance:record', 'attendance:read', 'event:read'];

export interface CreatedDevice {
  id: string;
  label: string;
  eventId: string | null;
  /** Read this to whoever is setting up the tablet. Single use, 15 minutes. */
  pairingCode: string;
  pairingExpiresAt: string;
  expiresAt: string;
  scopes: string[];
}

/**
 * Create a device and a pairing code.
 *
 * DEVIATION from §5.7, deliberate: that section returns the bearer token here
 * as well as at pairing. This does not. The admin never needs to handle the
 * token, and a long-lived credential sitting in an admin's clipboard or browser
 * history is exactly the exposure device tokens exist to remove. Only the
 * tablet ever sees it.
 */
export async function createDevice(
  db: Database,
  input: {
    organizationId: string;
    eventId?: string | null;
    label: string;
    scopes?: Permission[];
    expiresAt?: Date;
    issuedByAccountId?: string | null;
  }
): Promise<CreatedDevice> {
  let eventEndAt: Date | null = null;

  if (input.eventId) {
    const [event] = await db
      .select({ id: events.id, endAt: events.endAt })
      .from(events)
      .where(
        and(
          eq(events.id, input.eventId),
          eq(events.organizationId, input.organizationId),
          isNull(events.deletedAt)
        )
      )
      .limit(1);
    if (!event) throw problem.notFound(ProblemCode.EVENT_NOT_FOUND, 'Event not found.');
    eventEndAt = event.endAt;
  }

  const scopes = (input.scopes ?? DEFAULT_SCOPES).filter((s) =>
    (PERMISSIONS as readonly string[]).includes(s)
  );
  if (scopes.length === 0) {
    throw problem.badRequest(ProblemCode.VALIDATION_FAILED, 'At least one valid scope is required.');
  }

  const pairingCode = newPairingCode();
  const pairingExpiresAt = new Date(Date.now() + PAIRING_TTL_MS);

  // Expire with the EVENT, not on a flat timer.
  //
  // A Sunday service token that lives a week is a working credential sitting in
  // a drawer for six days it is not needed — precisely the exposure this
  // feature exists to close. A day's grace covers an event that overruns or a
  // tablet nobody unpaired on the night.
  const expiresAt =
    input.expiresAt ??
    (eventEndAt
      ? new Date(eventEndAt.getTime() + 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const [row] = await db
    .insert(deviceTokens)
    .values({
      organizationId: input.organizationId,
      eventId: input.eventId ?? null,
      label: input.label,
      scopes,
      pairingCode,
      pairingExpiresAt,
      expiresAt,
      issuedByAccountId: input.issuedByAccountId ?? null,
    })
    .returning({ id: deviceTokens.id });

  return {
    id: row.id,
    label: input.label,
    eventId: input.eventId ?? null,
    pairingCode,
    pairingExpiresAt: pairingExpiresAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    scopes,
  };
}

export interface PairedDevice {
  token: string;
  deviceId: string;
  label: string;
  eventId: string | null;
  organizationId: string;
  scopes: string[];
  expiresAt: string;
}

/**
 * Redeem a pairing code for a bearer token.
 *
 * Unauthenticated by necessity — the tablet has no credential yet; that is the
 * entire point. Safe because the code is short-lived, single-use, and grants
 * only what the device row already says.
 */
export async function pair(db: Database, pairingCode: string): Promise<PairedDevice> {
  const code = pairingCode.trim().toUpperCase();

  const [device] = await db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.pairingCode, code))
    .limit(1);

  // One answer for "no such code", "already used" and "expired". Telling them
  // apart lets someone probe for codes that exist.
  const reject = () =>
    problem.notFound(ProblemCode.NOT_FOUND, 'That pairing code is not valid.');

  if (!device) throw reject();
  if (device.revokedAt) throw reject();
  if (!device.pairingExpiresAt || device.pairingExpiresAt.getTime() < Date.now()) throw reject();

  const token = `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;

  const updated = await db
    .update(deviceTokens)
    .set({
      tokenHash: hash(token),
      pairedAt: new Date(),
      // Cleared, so the code cannot be redeemed twice. The UPDATE's WHERE makes
      // this atomic: two tablets racing the same code, one wins.
      pairingCode: null,
      pairingExpiresAt: null,
    })
    .where(and(eq(deviceTokens.id, device.id), eq(deviceTokens.pairingCode, code)))
    .returning({ id: deviceTokens.id });

  if (updated.length === 0) throw reject();

  return {
    token,
    deviceId: device.id,
    label: device.label,
    eventId: device.eventId,
    organizationId: device.organizationId,
    scopes: device.scopes,
    expiresAt: device.expiresAt.toISOString(),
  };
}

export interface VerifiedDevice {
  deviceId: string;
  organizationId: string;
  eventId: string | null;
  scopes: Permission[];
  label: string;
}

/**
 * Verify a bearer token presented by a device.
 *
 * Distinguishes revoked/expired from unknown, because unlike a pairing code
 * these are states a legitimate operator needs to see — a door reading
 * "token revoked" is actionable, "not found" is not.
 */
export async function verifyToken(db: Database, token: string): Promise<VerifiedDevice> {
  if (!token.startsWith(DEVICE_TOKEN_PREFIX)) {
    throw problem.unauthenticated('Not a device token.');
  }

  const [row] = await db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.tokenHash, hash(token)))
    .limit(1);

  if (!row) throw problem.unauthenticated('Unknown device token.');

  // The hash lookup already establishes possession; this guards against a
  // theoretical collision and costs nothing.
  const expected = Buffer.from(row.tokenHash ?? '');
  const actual = Buffer.from(hash(token));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw problem.unauthenticated('Unknown device token.');
  }

  // 401 with a SPECIFIC code, unlike the flat 401 for an unknown token: the
  // operator holds a real credential and needs to know it was turned off,
  // not that it was never valid (T14).
  if (row.revokedAt) {
    throw new ProblemError(401, ProblemCode.TOKEN_REVOKED, 'This device has been revoked.');
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new ProblemError(401, ProblemCode.TOKEN_REVOKED, 'This device token has expired.');
  }

  // Best-effort; a failure here must not refuse a legitimate check-in.
  void db
    .update(deviceTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(deviceTokens.id, row.id))
    .catch(() => {});

  return {
    deviceId: row.id,
    organizationId: row.organizationId,
    eventId: row.eventId,
    scopes: row.scopes as Permission[],
    label: row.label,
  };
}

/**
 * A device token is scoped to ONE event. Using it on another is out of scope,
 * not "not found" — the operator holds a real credential and needs to know it
 * is pointed at the wrong door (T13).
 */
export function assertEventInScope(device: VerifiedDevice, eventId: string): void {
  if (device.eventId && device.eventId !== eventId) {
    throw problem.forbidden(
      ProblemCode.OUT_OF_SCOPE,
      'This device is paired to a different event.'
    );
  }
}

export async function revoke(db: Database, organizationId: string, deviceId: string): Promise<void> {
  const revoked = await db
    .update(deviceTokens)
    .set({ revokedAt: new Date(), pairingCode: null, pairingExpiresAt: null })
    .where(
      and(
        eq(deviceTokens.id, deviceId),
        eq(deviceTokens.organizationId, organizationId),
        isNull(deviceTokens.revokedAt)
      )
    )
    .returning({ id: deviceTokens.id });

  if (revoked.length === 0) {
    throw problem.notFound(ProblemCode.NOT_FOUND, 'No such active device.');
  }
}

export async function listDevices(db: Database, organizationId: string, eventId?: string) {
  const conditions = [eq(deviceTokens.organizationId, organizationId)];
  if (eventId) conditions.push(eq(deviceTokens.eventId, eventId));

  const rows = await db
    .select()
    .from(deviceTokens)
    .where(and(...conditions))
    .orderBy(desc(deviceTokens.createdAt));

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    eventId: r.eventId,
    scopes: r.scopes,
    // A derived word rather than four booleans for the UI to combine.
    status: r.revokedAt
      ? ('revoked' as const)
      : r.expiresAt.getTime() < now
        ? ('expired' as const)
        : r.pairedAt
          ? ('active' as const)
          : ('pending' as const),
    pairedAt: r.pairedAt?.toISOString() ?? null,
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt.toISOString(),
    // Never the token, and never the code once redeemed.
    pairingCode: r.pairingCode,
  }));
}

