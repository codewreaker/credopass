/**
 * The two-tenant world the adversarial suite argues about.
 *
 * Everything here is built THROUGH THE API, not by inserting rows. That is the
 * point: a fixture that seeds `org_memberships` directly would prove the
 * queries filter correctly while saying nothing about whether the write paths
 * put the right tenant on the row in the first place — which is where tenancy
 * bugs actually live.
 *
 * The one exception is `revokeDevice`, which has no endpoint yet.
 */

import { request, type Actor } from './actors';
import { installTestIssuers, mintToken, type MintOptions } from './issuer';
import { getTestDatabase } from './database';
import { deviceTokens } from '@credopass/lib/schemas/tables';
import { eq } from 'drizzle-orm';

/** Unique per call, so a reset between tests cannot collide with a stale row. */
const unique = () => crypto.randomUUID().slice(0, 8);

export interface AccountOptions extends MintOptions {
  label?: string;
}

/**
 * An authenticated account with no organisation.
 *
 * Calls `GET /me` so `resolveCaller` creates the row — the same way a real
 * first request does, rather than reaching past it into the table.
 */
export async function newAccount(opts: AccountOptions = {}): Promise<Actor> {
  await installTestIssuers();

  const token = await mintToken(opts);
  const actor: Actor = {
    label: opts.label ?? 'account',
    accountId: '',
    organizationId: '',
    token,
  };

  const res = await request(actor, 'GET', '/me', { organizationId: null });
  if (res.status !== 200) {
    throw new Error(`fixture: GET /me answered ${res.status} for a freshly minted token`);
  }
  actor.accountId = (await res.json()).id;
  return actor;
}

/** An anonymous caller — a real Supabase anonymous sign-in asserts no email. */
export const newGuest = (label = 'guest'): Promise<Actor> =>
  newAccount({ label, isAnonymous: true });

/**
 * An account that owns a brand-new organisation.
 *
 * `POST /organizations` makes the caller its owner, so this is one call rather
 * than a create-then-grant dance.
 */
export async function newTenant(label: string): Promise<Actor> {
  const actor = await newAccount({
    label,
    email: `${label.toLowerCase()}-${unique()}@example.test`,
    emailVerified: true,
    name: `Owner ${label}`,
  });

  const res = await request(actor, 'POST', '/organizations', {
    organizationId: null,
    body: { name: `Org ${label} ${unique()}` },
  });
  if (res.status !== 201) {
    throw new Error(`fixture: POST /organizations answered ${res.status} for ${label}`);
  }

  actor.organizationId = (await res.json()).id;
  return actor;
}

/**
 * A second person inside someone else's organisation, at a chosen role.
 *
 * Goes through invite → accept because that is the only path that grants a
 * membership, and because it exercises the verified-email gate the suite
 * separately asserts on (T22).
 */
export async function joinAs(
  owner: Actor,
  role: 'admin' | 'organizer' | 'checkin' | 'viewer',
  label = role
): Promise<Actor> {
  const email = `${label}-${unique()}@example.test`;

  const invite = await request(owner, 'POST', `/organizations/${owner.organizationId}/invitations`, {
    body: { email, role },
  });
  if (invite.status !== 201) {
    throw new Error(`fixture: inviting a ${role} answered ${invite.status}`);
  }
  const { token: inviteToken } = await invite.json();

  const joiner = await newAccount({ label, email, emailVerified: true });

  const accept = await request(joiner, 'POST', `/invitations/${inviteToken}/accept`, {
    organizationId: null,
  });
  if (accept.status !== 200 && accept.status !== 201) {
    throw new Error(`fixture: accepting a ${role} invitation answered ${accept.status}`);
  }

  joiner.organizationId = owner.organizationId;
  return joiner;
}

export interface EventOptions {
  name?: string;
  startAt?: Date;
  endAt?: Date;
  capacity?: number;
  enforceCapacity?: boolean;
  allowSelfCheckIn?: boolean;
}

/** An event in the actor's organisation. Live by default, so check-in works. */
export async function newEvent(actor: Actor, opts: EventOptions = {}): Promise<string> {
  const startAt = opts.startAt ?? new Date(Date.now() - 60_000);
  const endAt = opts.endAt ?? new Date(Date.now() + 3_600_000);

  const res = await request(actor, 'POST', '/events', {
    body: {
      name: opts.name ?? `Event ${unique()}`,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      timezone: 'Europe/London',
      locationText: 'Main hall',
      ...(opts.capacity !== undefined ? { capacity: opts.capacity } : {}),
      ...(opts.enforceCapacity !== undefined ? { enforceCapacity: opts.enforceCapacity } : {}),
      ...(opts.allowSelfCheckIn !== undefined ? { allowSelfCheckIn: opts.allowSelfCheckIn } : {}),
    },
  });
  if (res.status !== 201) {
    throw new Error(`fixture: POST /events answered ${res.status} for ${actor.label}`);
  }
  return (await res.json()).id;
}

export interface PersonOptions {
  firstName?: string;
  lastName?: string;
  email?: string | null;
}

/** A person in the actor's organisation. */
export async function newPerson(actor: Actor, opts: PersonOptions = {}): Promise<string> {
  const res = await request(actor, 'POST', '/people', {
    body: {
      firstName: opts.firstName ?? 'Ada',
      lastName: opts.lastName ?? 'Lovelace',
      email: opts.email === null ? null : (opts.email ?? `person-${unique()}@example.test`),
    },
  });
  if (res.status !== 201) {
    throw new Error(`fixture: POST /people answered ${res.status} for ${actor.label}`);
  }
  return (await res.json()).id;
}

export interface Registration {
  personId: string;
  attendanceId: string;
  /** The bearer pass token. A URL, not a credential tied to an account. */
  passToken: string;
  passUrl: string;
}

/**
 * Register for a public event the way an attendee does — no token, no account.
 *
 * This is the fixture behind "attending is not belonging": it must go through
 * the public endpoint, because registering via an authenticated org-scoped
 * route would prove nothing about the anonymous path real attendees use.
 */
export async function registerFor(
  eventId: string,
  opts: { firstName?: string; lastName?: string; email?: string } = {}
): Promise<Registration> {
  const res = await request(null, 'POST', `/public/events/${eventId}/register`, {
    organizationId: null,
    idempotencyKey: crypto.randomUUID(),
    body: {
      firstName: opts.firstName ?? 'Walk',
      lastName: opts.lastName ?? 'In',
      email: opts.email ?? `walkin-${unique()}@example.test`,
    },
  });
  if (res.status !== 201) {
    throw new Error(`fixture: public registration answered ${res.status}`);
  }

  const body = await res.json();
  return {
    personId: body.person.id,
    attendanceId: body.attendance.id,
    passToken: body.pass.token,
    passUrl: body.pass.url,
  };
}

export interface Device {
  deviceId: string;
  /** The `cpd_`-prefixed bearer credential. */
  token: string;
  /** An Actor, so device tests read like every other test. */
  actor: Actor;
}

/**
 * A paired door tablet, scoped to one event.
 *
 * Two calls because the product deliberately never returns a token from the
 * creating call — the operator reads a pairing code to the tablet, and the
 * tablet redeems it.
 */
export async function newDevice(
  owner: Actor,
  eventId: string,
  label = 'door'
): Promise<Device> {
  const created = await request(owner, 'POST', `/events/${eventId}/devices`, {
    body: { label },
  });
  if (created.status !== 201) {
    throw new Error(`fixture: creating a device answered ${created.status}`);
  }
  const { id: deviceId, pairingCode } = await created.json();

  // Pairing is unauthenticated by design: the tablet has no credential yet.
  const paired = await request(null, 'POST', '/devices/pair', {
    organizationId: null,
    body: { pairingCode },
  });
  if (paired.status !== 200 && paired.status !== 201) {
    throw new Error(`fixture: pairing answered ${paired.status}`);
  }
  const { token } = await paired.json();

  return {
    deviceId,
    token,
    actor: {
      label,
      accountId: '',
      // A device names no organisation — its tenant comes from its own row.
      organizationId: '',
      token,
    },
  };
}

/**
 * Revoke a device directly.
 *
 * `DELETE /devices/{deviceId}` exists, but T14 needs a token that is revoked
 * *and still syntactically valid*, which is a state the API deliberately makes
 * hard to reach. Written here rather than asserted through the endpoint so the
 * test is about `verifyToken`'s response, not about the revoke route.
 */
export async function revokeDevice(deviceId: string): Promise<void> {
  const { db } = await getTestDatabase();
  await db
    .update(deviceTokens)
    .set({ revokedAt: new Date() })
    .where(eq(deviceTokens.id, deviceId));
}

/** The pair of mutually-suspicious tenants nearly every test needs. */
export interface TwoTenants {
  A: Actor;
  B: Actor;
  aEventId: string;
  bEventId: string;
  aPersonId: string;
  bPersonId: string;
}

export async function twoTenants(): Promise<TwoTenants> {
  const A = await newTenant('A');
  const B = await newTenant('B');

  const [aEventId, bEventId, aPersonId, bPersonId] = await Promise.all([
    newEvent(A, { name: "A's event" }),
    newEvent(B, { name: "B's event" }),
    newPerson(A, { firstName: 'Anna', lastName: 'Ay' }),
    newPerson(B, { firstName: 'Bob', lastName: 'Bee' }),
  ]);

  return { A, B, aEventId, bEventId, aPersonId, bPersonId };
}
