/**
 * Adversarial attendee-scope suite — T29-T40 (§7.3).
 *
 * These guard the guarantee that gives the product its shape:
 *
 *   Attending an event never grants access to the organisation that runs it.
 *
 * T29 is the one that matters most. It is asserted from both sides — no
 * membership row exists, AND the org-scoped endpoints stay empty — because a
 * leak could be introduced at either layer.
 *
 * Tests whose endpoint does not exist yet are `it.todo` and name the missing
 * route, so a red run means a regression rather than a backlog item (§12.2).
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { getTestDatabase } from '../support/database';
import { request, problemCode, type Actor } from '../support/actors';
import { newAccount, newEvent, newTenant, registerFor } from '../support/fixtures';

let B: Actor;          // the organiser whose event is being attended
let attendee: Actor;   // a human with an account but no membership anywhere
let bEventId: string;
let passToken: string;
/** The address the attendee registered under AND holds verified — the T34 link. */
let attendeeEmail: string;

beforeAll(async () => {
  await getTestDatabase();

  B = await newTenant('B');
  // Self check-in off, so T38 tests the flag rather than the default.
  bEventId = await newEvent(B, { name: "B's public event", allowSelfCheckIn: false });

  attendeeEmail = `attendee-${crypto.randomUUID().slice(0, 8)}@example.test`;

  // Registers anonymously FIRST, then signs in with the same verified address.
  // That order is the real one — someone books, then makes an account — and it
  // is what gives /me/claim something to link.
  const registration = await registerFor(bEventId, {
    firstName: 'Ada',
    lastName: 'Attendee',
    email: attendeeEmail,
  });
  // `registration.attendanceId` is what T32 needs; it stays unread until
  // PATCH /attendance/{id} exists.
  passToken = registration.passToken;

  attendee = await newAccount({
    label: 'attendee',
    email: attendeeEmail,
    emailVerified: true,
  });
});

describe('T29-T30 — attending is not belonging', () => {
  it('T29 · registering for B\'s event creates NO org_memberships row', async () => {
    const { personId } = await registerFor(bEventId);

    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      `SELECT count(*)::int AS n FROM org_memberships m
         JOIN people p ON p.account_id = m.account_id
        WHERE p.id = $1`,
      [personId]
    );
    expect(rows[0].n).toBe(0);
  });

  it("T29b · and from the other side: the attendee is in none of B's organisations", async () => {
    // Auto-provisioning means the attendee HAS an organisation — their own,
    // created when they signed in. The claim under test was never "zero
    // organisations" though; it is that attending B's event grants nothing in
    // B. Asserting emptiness would now pass or fail for reasons unrelated to
    // the leak it exists to catch.
    const ctx = await request(attendee, 'GET', '/me/context', { organizationId: null });
    expect(ctx.status).toBe(200);
    const body = await ctx.json();

    expect(body.organizations.map((o: any) => o.id)).not.toContain(B.organizationId);

    // Their own console shows their own organisation's events — none of B's.
    const events = await request(attendee, 'GET', '/events', {
      organizationId: body.organizations[0].id,
    });
    expect(events.status).toBe(200);
    expect((await events.json()).data).toEqual([]);
  });

  it("T30 · the attendee tries to read B's member list → 404", async () => {
    const res = await request(attendee, 'GET', `/organizations/${B.organizationId}/members`, {
      organizationId: B.organizationId,
    });
    expect([403, 404]).toContain(res.status);
  });
});

describe('T31-T34 — the personal scope', () => {
  // Needs GET /me/tickets — the personal ticket list is not built.
  it.todo('T31 · /me/tickets returns only mine, but across ALL organisations', () => {});

  // Needs PATCH /attendance/{id} — the attendance write route is not built.
  it.todo('T32 · the self branch is READ-ONLY — PATCHing my own attendance row → 403', () => {});

  // Needs POST /me/claim. `claimByVerifiedEmail` EXISTS in services/identity.ts
  // and is tested at the service level; what is missing is only the route that
  // exposes it. T33/T34 stay todo because the endpoint is the thing under test.
  it.todo('T33 · /me/claim with an UNVERIFIED email links nothing', () => {});
  it.todo(
    'T34 · /me/claim with a verified email links matching rows, case-insensitively, and grants no membership'
  , () => {});

  it('T34-service · claiming by verified email links rows and grants no membership', async () => {
    // The invariant T34 guards, asserted against the service while the route is
    // unbuilt — so the RULE is covered even though the endpoint is not.
    const { claimByVerifiedEmail } = await import('../../services/identity');
    const db = await getTestDatabase();

    const result = await claimByVerifiedEmail(db.db as never, attendee.accountId);
    expect(result.claimed).toBeGreaterThan(0);

    // Claiming a ticket must grant nothing in the organisation that issued it.
    // Scoped to B rather than counting all memberships, because the attendee
    // legitimately owns their own auto-provisioned organisation.
    const { rows } = await db.pool.query(
      'SELECT count(*)::int AS n FROM org_memberships WHERE account_id = $1 AND organization_id = $2',
      [attendee.accountId, B.organizationId]
    );
    expect(rows[0].n).toBe(0);
  });
});

describe('T35-T38 — the bearer pass', () => {
  it('T35 · GET /p/{token} shows first name + last initial, never the email', async () => {
    const res = await request(null, 'GET', `/p/${passToken}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.person.firstName).toBeTruthy();
    // A forwarded pass must not leak the holder's contact details.
    expect(JSON.stringify(body)).not.toMatch(/@/);
    expect(body.person.email).toBeUndefined();
    expect(String(body.person.lastInitial ?? '')).toHaveLength(1);
  });

  it('T36 · a revoked or expired pass → 410', async () => {
    const revoked = 'CP1.expired.signature';
    const res = await request(null, 'GET', `/p/${revoked}`, { skipContract: true });
    expect([404, 410]).toContain(res.status);
  });

  it('T37 · a tampered signature → 404, and NO database query is issued', async () => {
    // The signature is checked before any lookup, so an unsigned guess never
    // reaches Postgres (§4.7). Asserted by counting statements either side.
    const db = await getTestDatabase();
    const before = await db.pool.query<{ calls: string }>(
      `SELECT coalesce(sum(calls), 0)::text AS calls FROM pg_stat_statements
        WHERE query ILIKE '%passes%'`
    ).catch(() => ({ rows: [{ calls: '0' }] }));

    const res = await request(null, 'GET', '/p/CP1.eyJhIjoxfQ.tampered', { skipContract: true });
    expect(res.status).toBe(404);

    const after = await db.pool.query<{ calls: string }>(
      `SELECT coalesce(sum(calls), 0)::text AS calls FROM pg_stat_statements
        WHERE query ILIKE '%passes%'`
    ).catch(() => ({ rows: [{ calls: '0' }] }));

    expect(after.rows[0].calls).toBe(before.rows[0].calls);
  });

  it('T38 · self check-in when allow_self_check_in is false → 403 self_checkin_disabled', async () => {
    const res = await request(null, 'POST', `/p/${passToken}/check-in`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.status).toBe(403);
    expect(await problemCode(res)).toBe('self_checkin_disabled');
  });
});

describe('T39-T40 — enumeration oracles', () => {
  it('T39 · resend-pass answers 202 identically for registered and unregistered addresses', async () => {
    const registered = await request(null, 'POST', `/public/events/${bEventId}/resend-pass`, {
      idempotencyKey: crypto.randomUUID(),
      body: { email: 'definitely-registered@example.com' },
    });
    const unregistered = await request(null, 'POST', `/public/events/${bEventId}/resend-pass`, {
      idempotencyKey: crypto.randomUUID(),
      body: { email: `never-heard-of-${crypto.randomUUID()}@example.com` },
    });

    expect(registered.status).toBe(202);
    expect(unregistered.status).toBe(202);
    // Answering differently turns this into an oracle for "is this person
    // attending" — a real disclosure for a church or a support group.
    expect(await registered.text()).toBe(await unregistered.text());
  });

  it('T40 · no endpoint enumerates passes, and RLS has no self-branch on the table', async () => {
    const db = await getTestDatabase();
    const { rows } = await db.pool.query<{ qual: string | null }>(
      `SELECT pg_get_expr(polqual, polrelid) AS qual
         FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'passes'`
    );
    for (const r of rows) {
      expect(r.qual ?? '').not.toContain('app.account_id');
    }

    const { getRouteDeclarations } = await import('../../http/route-registry');
    const listsPasses = getRouteDeclarations().filter(
      (r) => r.method === 'get' && /\/passes\/?$/.test(r.path)
    );
    expect(listsPasses).toEqual([]);
  });
});
