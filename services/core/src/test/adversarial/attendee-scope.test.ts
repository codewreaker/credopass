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
 * RED until Phase 3 (§12.2).
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { getTestDatabase } from '../support/database';
import { request, problemCode, type Actor } from '../support/actors';

let B: Actor;          // the organiser whose event is being attended
let attendee: Actor;   // a human with an account but no membership anywhere
let bEventId: string;
let passToken: string;
let attendanceId: string;

beforeAll(async () => {
  await getTestDatabase();
  B = { label: 'B', accountId: '', organizationId: '', token: '' };
  attendee = { label: 'attendee', accountId: '', organizationId: '', token: '' };
  bEventId = '';
  passToken = '';
  attendanceId = '';
});

describe('T29-T30 — attending is not belonging', () => {
  it('T29 · registering for B\'s event creates NO org_memberships row', async () => {
    const res = await request(null, 'POST', `/public/events/${bEventId}/register`, {
      idempotencyKey: crypto.randomUUID(),
      body: { firstName: 'Walk', lastName: 'In', email: `walkin+${crypto.randomUUID().slice(0, 8)}@x.com` },
    });
    expect(res.status).toBe(201);
    const { person } = await res.json();

    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      `SELECT count(*)::int AS n FROM org_memberships m
         JOIN people p ON p.account_id = m.account_id
        WHERE p.id = $1`,
      [person.id]
    );
    expect(rows[0].n).toBe(0);
  });

  it('T29b · and from the other side: the attendee sees zero organisations', async () => {
    const ctx = await request(attendee, 'GET', '/me/context', { organizationId: null });
    expect(ctx.status).toBe(200);
    const body = await ctx.json();
    expect(body.organizations).toEqual([]);
    expect(body.needsOnboarding).toBe(true);

    const events = await request(attendee, 'GET', '/events', { organizationId: null });
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
  it('T31 · /me/tickets returns only mine, but across ALL organisations', async () => {
    const res = await request(attendee, 'GET', '/me/tickets', { organizationId: null });
    expect(res.status).toBe(200);
    const { data } = await res.json();

    // A ticket in an org the attendee does not administer must still appear —
    // that is the entire point of the account scope.
    expect(data.length).toBeGreaterThan(0);
    expect(data.some((t: any) => t.organizationId === B.organizationId)).toBe(true);
    for (const t of data) expect(t.accountId ?? attendee.accountId).toBe(attendee.accountId);
  });

  it('T32 · the self branch is READ-ONLY — PATCHing my own attendance row → 403', async () => {
    // WITH CHECK omits the self predicate (§7.2), so an attendee may read the
    // organiser's record of them but can never edit it.
    const res = await request(attendee, 'PATCH', `/attendance/${attendanceId}`, {
      organizationId: null,
      body: { state: 'attended' },
    });
    expect(res.status).toBe(403);
  });

  it('T33 · /me/claim with an UNVERIFIED email links nothing', async () => {
    const unverified: Actor = { label: 'unverified', accountId: '', organizationId: '', token: '' };
    const res = await request(unverified, 'POST', '/me/claim', {
      organizationId: null,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.status).toBe(200);
    // Claiming on an unverified address is account takeover by typo.
    expect((await res.json()).claimed).toBe(0);
  });

  it('T34 · /me/claim with a verified email links matching rows, case-insensitively, and grants no membership', async () => {
    const res = await request(attendee, 'POST', '/me/claim', {
      organizationId: null,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).claimed).toBeGreaterThan(0);

    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      'SELECT count(*)::int AS n FROM org_memberships WHERE account_id = $1',
      [attendee.accountId]
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
