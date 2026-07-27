/**
 * The attendee walk. docs/API-FIRST-REBUILD.md §12.3a
 *
 * The scenario, automated exactly as stated: someone with no app and no account
 * opens a link, registers, closes the tab, opens the pass on another device
 * days later, and gets through the door.
 *
 * It crosses three isolated HTTP clients with no shared cookie jar, because
 * that is the only way to prove the pass is DURABLE rather than session-bound.
 * The old implementation rendered the QR into React state — passing a test with
 * one client would have proved nothing.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import { v1, V1_BASE_PATH } from '../../api/v1/core';
import { attendance, events, orgMemberships, organizations } from '@credopass/lib/schemas/tables';
import { eq } from 'drizzle-orm';

let harness: TestDatabase;
let db: any;
let orgId: string;
let eventId: string;

const HOUR = 3_600_000;

/**
 * A fresh HTTP client. Deliberately just a function — the point is that these
 * share NOTHING, so "device 2" cannot benefit from anything device 1 held.
 */
const device = () => ({
  get: (path: string) => v1.request(path),
  post: (path: string, body?: unknown) =>
    v1.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
});

/** Bodies are dynamic JSON; the contract harness checks their shape. */
const body = async (res: Response): Promise<any> => res.clone().json();

const rel = (url: string) => url.replace(/^https?:\/\/[^/]+/, '').replace(V1_BASE_PATH, '');

beforeAll(async () => {
  process.env.PASS_SIGNING_KEY ??= 'test-signing-key-not-for-production';
  harness = await getTestDatabase();
  db = harness.db;
});

beforeEach(async () => {
  await harness.reset();
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Kharis Church', slug: `k-${crypto.randomUUID().slice(0, 8)}` })
    .returning({ id: organizations.id });
  orgId = org.id;

  const [event] = await db
    .insert(events)
    .values({
      organizationId: orgId,
      name: 'Sunday Service',
      startAt: new Date(Date.now() - 0.5 * HOUR),
      endAt: new Date(Date.now() + 1.5 * HOUR),
      locationText: 'Main hall',
      shortCode: crypto.randomUUID().slice(0, 12),
      timezone: 'Europe/London',
    })
    .returning({ id: events.id });
  eventId = event.id;
});

afterAll(async () => {
  await harness.stop();
});

describe('the attendee walk (§12.3a)', () => {
  it('registers on a phone, opens the pass on a laptop, checks in at the door', async () => {
    // ---- 1. Phone, no account. The shared link. --------------------------
    const phone = device();
    const eventPage = await phone.get(`/public/events/${eventId}`);
    expect(eventPage.status).toBe(200);
    const publicEvent = await body(eventPage);
    expect(publicEvent.name).toBe('Sunday Service');
    expect(publicEvent.organizationName).toBe('Kharis Church');

    // ---- 2. Register. No password, no account. ---------------------------
    const registered = await phone.post(`/public/events/${eventId}/register`, {
      firstName: 'Walk',
      lastName: 'In',
      email: 'walkin@example.com',
    });
    expect(registered.status).toBe(201);
    const { pass, person } = await body(registered);

    // The pass URL is in the RESPONSE, synchronously. Mail is a convenience.
    expect(pass.url).toContain('/p/');
    expect(pass.token).toStartWith('CP1.');

    // T29: registering created NO membership. This is the whole guarantee.
    const memberships = await db.select().from(orgMemberships);
    expect(memberships).toHaveLength(0);

    // ---- 3. Discard the phone entirely — the tab is closed. --------------
    // Nothing from `phone` is used again.

    // ---- 4. Laptop, days later, no session. ------------------------------
    const laptop = device();
    const passPage = await laptop.get(rel(pass.url));
    expect(passPage.status).toBe(200);
    const view = await body(passPage);

    expect(view.event.name).toBe('Sunday Service');
    expect(view.person.firstName).toBe('Walk');
    expect(view.person.lastInitial).toBe('I');

    // T35: a forwarded pass must not leak the holder's contact details.
    expect(JSON.stringify(view)).not.toContain('walkin@example.com');
    expect(JSON.stringify(view)).not.toContain('@');

    // ---- 5. Kiosk at the door scans the QR. ------------------------------
    const kiosk = device();
    const scanned = await kiosk.post(`/public/events/${eventId}/check-in`, {
      pass: view.pass.qrValue,
    });
    expect(scanned.status).toBe(200);
    const first = await body(scanned);
    expect(first.attendance.state).toBe('attended');
    expect(first.alreadyRecorded).toBe(false);

    // ---- 6. Scanned twice, because doors are chaotic. --------------------
    const rescanned = await kiosk.post(`/public/events/${eventId}/check-in`, {
      pass: view.pass.qrValue,
    });
    expect(rescanned.status).toBe(200);
    expect((await body(rescanned)).alreadyRecorded).toBe(true);

    const rows = await db.select().from(attendance).where(eq(attendance.eventId, eventId));
    expect(rows).toHaveLength(1);
    expect(rows[0].personId).toBe(person.id);

    // ---- 7. Still no membership, from the other side. --------------------
    expect(await db.select().from(orgMemberships)).toHaveLength(0);
  });
});

describe('the pass is a bearer credential, with the limits that implies', () => {
  it('self check-in from the pass respects allow_self_check_in (T38)', async () => {
    await db.update(events).set({ allowSelfCheckIn: false }).where(eq(events.id, eventId));

    const client = device();
    const registered = await client.post(`/public/events/${eventId}/register`, {
      firstName: 'No', lastName: 'Entry', email: 'noentry@example.com',
    });
    const { pass } = await body(registered);

    const attempt = await client.post(`${rel(pass.url)}/check-in`);
    expect(attempt.status).toBe(403);
    expect((await body(attempt)).code).toBe('self_checkin_disabled');
  });

  it('a tampered token never reaches a check-in', async () => {
    const client = device();
    const res = await client.get('/p/CP1.eyJhIjoxfQ.salt.tampered');
    expect([400, 404, 410]).toContain(res.status);
  });
});

describe('resend-pass is not an enumeration oracle (T39)', () => {
  it('answers identically for a registered and an unregistered address', async () => {
    const client = device();
    await client.post(`/public/events/${eventId}/register`, {
      firstName: 'Real', lastName: 'Person', email: 'real@example.com',
    });

    const known = await client.post(`/public/events/${eventId}/resend-pass`, {
      email: 'real@example.com',
    });
    const unknown = await client.post(`/public/events/${eventId}/resend-pass`, {
      email: `nobody-${crypto.randomUUID()}@example.com`,
    });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    // Byte-identical. Anything else tells an attacker who is attending.
    expect(await known.text()).toBe(await unknown.text());
  });
});

describe('the public surface shows what a poster shows, and no more', () => {
  it('never exposes the attendee list or counts', async () => {
    const client = device();
    await client.post(`/public/events/${eventId}/register`, {
      firstName: 'Someone', lastName: 'Private', email: 'private@example.com',
    });

    const page = await body(await client.get(`/public/events/${eventId}`));
    const raw = JSON.stringify(page);

    expect(raw).not.toContain('private@example.com');
    expect(raw).not.toContain('Private');
    expect(page).not.toHaveProperty('attendees');
    expect(page).not.toHaveProperty('registered');
  });

  it('a cancelled event still resolves, and says why', async () => {
    // A printed poster keeps working. It now reads "cancelled" rather than 404.
    await db
      .update(events)
      .set({ cancelledAt: new Date(), cancellationReason: 'Venue flooded' })
      .where(eq(events.id, eventId));

    const res = await device().get(`/public/events/${eventId}`);
    expect(res.status).toBe(200);
    const parsed = await body(res);
    expect(parsed.status).toBe("cancelled");
    expect(parsed.cancellationReason).toBe('Venue flooded');
  });

  it('refuses registration once an event has finished', async () => {
    await db
      .update(events)
      .set({ startAt: new Date(Date.now() - 48 * HOUR), endAt: new Date(Date.now() - 47 * HOUR) })
      .where(eq(events.id, eventId));

    const res = await device().post(`/public/events/${eventId}/register`, {
      firstName: 'Too', lastName: 'Late', email: 'late@example.com',
    });
    expect(res.status).toBe(409);
    expect((await body(res)).code).toBe('event_closed');
  });

  it('reports capacity remaining when the event enforces it', async () => {
    await db
      .update(events)
      .set({ capacity: 2, enforceCapacity: true })
      .where(eq(events.id, eventId));

    const client = device();
    expect((await body(await client.get(`/public/events/${eventId}`))).capacityRemaining).toBe(2);

    await client.post(`/public/events/${eventId}/register`, {
      firstName: 'One', lastName: 'Seat', email: 'one@example.com',
    });
    expect((await body(await client.get(`/public/events/${eventId}`))).capacityRemaining).toBe(1);
  });
});
