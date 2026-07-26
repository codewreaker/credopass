/**
 * Device tokens (D9, T13, T14) against a real Postgres.
 *
 * The property under test is containment: a stolen door tablet must be worth
 * almost nothing. It can record attendance at ONE event and do nothing else —
 * not read the roll of another event, not edit anything, not see the
 * organisation.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import * as Device from '../../services/device';
import { can, canOnEvent, createTenantContext } from '../../tenancy/context';
import { deviceTokens, events, organizations } from '@credopass/lib/schemas/tables';
import { eq } from 'drizzle-orm';

let harness: TestDatabase;
let db: any;
let orgA: string;
let orgB: string;
let eventA: string;
let eventB: string;

const HOUR = 3_600_000;

const makeOrg = async (name: string) => {
  const [o] = await db
    .insert(organizations)
    .values({ name, slug: `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}` })
    .returning({ id: organizations.id });
  return o.id;
};

const makeEvent = async (organizationId: string, name: string) => {
  const [e] = await db
    .insert(events)
    .values({
      organizationId,
      name,
      startAt: new Date(Date.now() - 0.5 * HOUR),
      endAt: new Date(Date.now() + 1.5 * HOUR),
      locationText: 'Door',
      shortCode: crypto.randomUUID().slice(0, 12),
    })
    .returning({ id: events.id });
  return e.id;
};

beforeAll(async () => {
  harness = await getTestDatabase();
  db = harness.db;
});

beforeEach(async () => {
  await harness.reset();
  orgA = await makeOrg('OrgA');
  orgB = await makeOrg('OrgB');
  eventA = await makeEvent(orgA, 'Event A');
  eventB = await makeEvent(orgB, 'Event B');
});

afterAll(async () => {
  await harness.stop();
});

describe('pairing', () => {
  it('creating a device returns a code, never a token', async () => {
    const device = await Device.createDevice(db, {
      organizationId: orgA, eventId: eventA, label: 'Main door',
    });

    expect(device.pairingCode).toHaveLength(8);
    // The admin must never handle the bearer token.
    expect(JSON.stringify(device)).not.toContain('cpd_');
    expect(device).not.toHaveProperty('token');
  });

  it('the pairing code avoids confusable characters', async () => {
    // It gets read aloud and typed on a tablet. 0/O and 1/I/L are a support call.
    for (let i = 0; i < 25; i++) {
      const { pairingCode } = await Device.createDevice(db, {
        organizationId: orgA, eventId: eventA, label: `Door ${i}`,
      });
      expect(pairingCode).not.toMatch(/[01OIL5S8B]/);
    }
  });

  it('redeeming a code yields a token', async () => {
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });
    const paired = await Device.pair(db, created.pairingCode);

    expect(paired.token).toStartWith('cpd_');
    expect(paired.eventId).toBe(eventA);
    expect(paired.organizationId).toBe(orgA);
  });

  it('the raw token is never stored', async () => {
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });
    const paired = await Device.pair(db, created.pairingCode);

    const rows = await db.select().from(deviceTokens);
    expect(JSON.stringify(rows)).not.toContain(paired.token);
  });

  it('a code is SINGLE USE', async () => {
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });
    await Device.pair(db, created.pairingCode);

    await expect(Device.pair(db, created.pairingCode)).rejects.toMatchObject({ status: 404 });
  });

  it('two tablets racing the same code — exactly one wins', async () => {
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });

    const results = await Promise.allSettled([
      Device.pair(db, created.pairingCode),
      Device.pair(db, created.pairingCode),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('an expired code is refused', async () => {
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });
    await db
      .update(deviceTokens)
      .set({ pairingExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(deviceTokens.id, created.id));

    await expect(Device.pair(db, created.pairingCode)).rejects.toMatchObject({ status: 404 });
  });

  it('an unknown code is refused with the SAME answer as an expired one', async () => {
    // Distinguishing them lets someone probe for codes that exist.
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });
    await db.update(deviceTokens).set({ pairingExpiresAt: new Date(Date.now() - 1000) }).where(eq(deviceTokens.id, created.id));

    const expired = await Device.pair(db, created.pairingCode).catch((e) => e);
    const unknown = await Device.pair(db, 'ZZZZZZZZ').catch((e) => e);

    expect(expired.status).toBe(unknown.status);
    expect(expired.detail).toBe(unknown.detail);
  });
});

describe('verification', () => {
  const pairDevice = async (organizationId: string, eventId: string | null) => {
    const created = await Device.createDevice(db, { organizationId, eventId, label: 'Door' });
    return Device.pair(db, created.pairingCode);
  };

  it('a valid token resolves to its device', async () => {
    const { token } = await pairDevice(orgA, eventA);
    const verified = await Device.verifyToken(db, token);

    expect(verified.organizationId).toBe(orgA);
    expect(verified.eventId).toBe(eventA);
    expect(verified.scopes).toContain('attendance:record');
  });

  it('T14 · a revoked device gives 401 token_revoked, not a flat 401', async () => {
    // An operator at a door needs "this was turned off", which is actionable.
    // "Unknown token" is not.
    const { token, deviceId } = await pairDevice(orgA, eventA);
    await Device.revoke(db, orgA, deviceId);

    await expect(Device.verifyToken(db, token)).rejects.toMatchObject({
      status: 401,
      code: 'token_revoked',
    });
  });

  it('an expired token is refused', async () => {
    const { token, deviceId } = await pairDevice(orgA, eventA);
    await db.update(deviceTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(deviceTokens.id, deviceId));

    await expect(Device.verifyToken(db, token)).rejects.toMatchObject({ code: 'token_revoked' });
  });

  it('a made-up token is refused', async () => {
    await expect(Device.verifyToken(db, 'cpd_totallymadeup')).rejects.toMatchObject({ status: 401 });
  });

  it('a JWT is not a device token', async () => {
    await expect(Device.verifyToken(db, 'eyJhbGciOiJIUzI1NiJ9.e30.x')).rejects.toMatchObject({ status: 401 });
  });

  it('records last-used without blocking the check-in', async () => {
    const { token, deviceId } = await pairDevice(orgA, eventA);
    await Device.verifyToken(db, token);
    await new Promise((r) => setTimeout(r, 50));

    const [row] = await db.select().from(deviceTokens).where(eq(deviceTokens.id, deviceId));
    expect(row.lastUsedAt).not.toBeNull();
  });
});

describe('T13 · scope containment — the point of the whole feature', () => {
  const pairDevice = async (organizationId: string, eventId: string | null) => {
    const created = await Device.createDevice(db, { organizationId, eventId, label: 'Door' });
    const paired = await Device.pair(db, created.pairingCode);
    return Device.verifyToken(db, paired.token);
  };

  it('a token for event A is out of scope on event B', async () => {
    const device = await pairDevice(orgA, eventA);
    expect(() => Device.assertEventInScope(device, eventB)).toThrow();

    try {
      Device.assertEventInScope(device, eventB);
    } catch (e: any) {
      // 403, not 404: the operator holds a real credential pointed at the
      // wrong door, and needs to be told that rather than "no such event".
      expect(e.status).toBe(403);
      expect(e.code).toBe('out_of_scope');
    }
  });

  it('an org-wide device is in scope for any of its events', async () => {
    const device = await pairDevice(orgA, null);
    expect(() => Device.assertEventInScope(device, eventA)).not.toThrow();
  });

  it('a stolen tablet can record attendance and NOTHING else', async () => {
    const device = await pairDevice(orgA, eventA);
    const ctx = createTenantContext({
      organizationId: device.organizationId,
      accountId: null,
      deviceId: device.deviceId,
      role: 'checkin',
      deviceScopes: device.scopes,
    });

    expect(can(ctx, 'attendance:record')).toBe(true);
    expect(can(ctx, 'event:read')).toBe(true);

    // Everything an org session would have given it:
    for (const forbidden of [
      'event:create', 'event:update', 'event:delete', 'event:cancel',
      'person:create', 'person:update', 'person:delete',
      'member:read', 'member:invite', 'member:remove',
      'org:update', 'org:delete', 'org:billing',
      'device:manage', 'analytics:read', 'analytics:export',
    ] as const) {
      expect(can(ctx, forbidden), `device must not hold ${forbidden}`).toBe(false);
    }
  });

  it('an event grant cannot lift a device above its issued scopes', async () => {
    // The hole worth naming: a tablet paired to an event it also holds a grant
    // on must not escape the scopes it was issued.
    const device = await pairDevice(orgA, eventA);
    const ctx = createTenantContext({
      organizationId: device.organizationId,
      accountId: null,
      deviceId: device.deviceId,
      role: 'organizer',
      deviceScopes: device.scopes,
      eventGrants: new Map([[eventA, 'organizer']]),
    });

    expect(canOnEvent(ctx, eventA, 'event:update')).toBe(false);
    expect(canOnEvent(ctx, eventA, 'device:manage')).toBe(false);
    expect(canOnEvent(ctx, eventA, 'attendance:record')).toBe(true);
  });

  it('narrower scopes than the default are honoured', async () => {
    const created = await Device.createDevice(db, {
      organizationId: orgA, eventId: eventA, label: 'Read-only display',
      scopes: ['attendance:read', 'event:read'],
    });
    const paired = await Device.pair(db, created.pairingCode);
    const device = await Device.verifyToken(db, paired.token);

    const ctx = createTenantContext({
      organizationId: orgA, accountId: null, deviceId: device.deviceId,
      role: 'checkin', deviceScopes: device.scopes,
    });

    // A billboard that displays the count but cannot admit anyone.
    expect(can(ctx, 'attendance:read')).toBe(true);
    expect(can(ctx, 'attendance:record')).toBe(false);
  });
});

describe('management', () => {
  it('lists devices with a derived status', async () => {
    const pending = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Not yet paired' });
    const active = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Paired' });
    await Device.pair(db, active.pairingCode);

    const devices = await Device.listDevices(db, orgA);
    const byLabel = Object.fromEntries(devices.map((d) => [d.label, d.status]));

    expect(byLabel['Not yet paired']).toBe('pending');
    expect(byLabel['Paired']).toBe('active');
    expect(devices.find((d) => d.id === pending.id)?.pairingCode).toBeTruthy();
  });

  it('never leaks a token through the list', async () => {
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });
    const paired = await Device.pair(db, created.pairingCode);

    const devices = await Device.listDevices(db, orgA);
    expect(JSON.stringify(devices)).not.toContain(paired.token);
    expect(JSON.stringify(devices)).not.toContain('cpd_');
  });

  it('does not list another org\'s devices', async () => {
    await Device.createDevice(db, { organizationId: orgB, eventId: eventB, label: 'B door' });
    const devices = await Device.listDevices(db, orgA);
    expect(devices).toHaveLength(0);
  });

  it("refuses to revoke another org's device", async () => {
    const bDevice = await Device.createDevice(db, { organizationId: orgB, eventId: eventB, label: 'B door' });
    await expect(Device.revoke(db, orgA, bDevice.id)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to create a device for an event in another org', async () => {
    await expect(
      Device.createDevice(db, { organizationId: orgA, eventId: eventB, label: 'Sneaky' })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('revoking clears any unredeemed pairing code', async () => {
    const created = await Device.createDevice(db, { organizationId: orgA, eventId: eventA, label: 'Door' });
    await Device.revoke(db, orgA, created.id);

    await expect(Device.pair(db, created.pairingCode)).rejects.toMatchObject({ status: 404 });
  });

});

describe('expiry follows the event, not a flat timer', () => {
  it('a device for an event expires a day after that event ends', async () => {
    // Regression: `createDevice` fetched the event's endAt and never used it,
    // so a Sunday-service tablet held a working credential for a week. Exactly
    // the exposure the feature exists to close.
    const [event] = await db.select().from(events).where(eq(events.id, eventA));
    const device = await Device.createDevice(db, {
      organizationId: orgA, eventId: eventA, label: 'Door',
    });

    const expected = event.endAt.getTime() + 24 * 60 * 60 * 1000;
    expect(new Date(device.expiresAt).getTime()).toBe(expected);
  });

  it('an explicit expiry still wins', async () => {
    const explicit = new Date(Date.now() + 90 * 60 * 1000);
    const device = await Device.createDevice(db, {
      organizationId: orgA, eventId: eventA, label: 'Short-lived', expiresAt: explicit,
    });
    expect(new Date(device.expiresAt).getTime()).toBe(explicit.getTime());
  });
});
