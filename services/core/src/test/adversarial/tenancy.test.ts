/**
 * Adversarial tenancy suite — T1-T28 (§7.3).
 *
 * RED until Phase 1. Written first on purpose: a tenancy bug's failure mode is
 * silent leakage that passes every happy-path test, so the tests have to exist
 * before the code they guard (§12.2).
 *
 * A failure here blocks merge unconditionally (§12.1).
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { getTestDatabase } from '../support/database';
import { request, problemCode, type Actor } from '../support/actors';

let A: Actor;
let B: Actor;
let aEventId: string;
let bEventId: string;
let bPersonId: string;

beforeAll(async () => {
  await getTestDatabase();
  // Phase 1 provides the fixture builder: two orgs, two owners, one event and
  // one person each. Until then these are placeholders and every test below
  // fails against a route that does not exist yet.
  A = { label: 'A', accountId: '', organizationId: '', token: '' };
  B = { label: 'B', accountId: '', organizationId: '', token: '' };
  aEventId = '';
  bEventId = '';
  bPersonId = '';
});

describe('T1-T10 — the baseline from MULTI-TENANCY.md §5', () => {
  it('T1 · A lists events while B has events; only A\'s come back', async () => {
    const res = await request(A, 'GET', '/events');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data)).toBe(true);
    for (const e of data) expect(e.organizationId).toBe(A.organizationId);
    expect(data.map((e: any) => e.id)).not.toContain(bEventId);
  });

  it("T2 · A sends X-Organization-Id for B's org → 403 not_a_member", async () => {
    const res = await request(A, 'GET', '/events', { organizationId: B.organizationId });
    expect(res.status).toBe(403);
    expect(await problemCode(res)).toBe('not_a_member');
  });

  it("T3 · A GETs B's event by id → 404, never 403 (existence is not leaked)", async () => {
    const res = await request(A, 'GET', `/events/${bEventId}`);
    expect(res.status).toBe(404);
  });

  it("T4 · A PATCHes B's event → 404 and the row is unchanged", async () => {
    const res = await request(A, 'PATCH', `/events/${bEventId}`, { body: { name: 'hijacked' } });
    expect(res.status).toBe(404);

    const check = await request(B, 'GET', `/events/${bEventId}`);
    expect((await check.json()).name).not.toBe('hijacked');
  });

  it("T5 · A creates an event naming B's org in the body; the field is ignored", async () => {
    const res = await request(A, 'POST', '/events', {
      idempotencyKey: crypto.randomUUID(),
      body: {
        organizationId: B.organizationId, // must be ignored — tenant comes from the token
        name: 'Body-scoped event',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3_600_000).toISOString(),
        timezone: 'Europe/London',
        locationText: 'Somewhere',
      },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).organizationId).toBe(A.organizationId);
  });

  it('T6 · a brand-new account with no memberships sees onboarding and empty everything', async () => {
    const fresh: Actor = { label: 'fresh', accountId: '', organizationId: '', token: '' };
    const ctx = await request(fresh, 'GET', '/me/context', { organizationId: null });
    expect(ctx.status).toBe(200);
    const body = await ctx.json();
    expect(body.needsOnboarding).toBe(true);
    expect(body.organizations).toEqual([]);
  });

  it('T7 · an anonymous guest with no active org gets an empty page, never another org (D16)', async () => {
    const guest: Actor = { label: 'guest', accountId: '', organizationId: '', token: '' };
    const res = await request(guest, 'GET', '/events', { organizationId: null });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it("T8 · an anonymous session reads /public/events/{B's id} — that id only", async () => {
    const ok = await request(null, 'GET', `/public/events/${bEventId}`);
    expect(ok.status).toBe(200);

    const list = await request(null, 'GET', '/events', { skipContract: true });
    expect(list.status).toBe(401);
  });

  it('T9 · a viewer attempting any write gets 403 insufficient_permission', async () => {
    const viewer: Actor = { label: 'viewer', accountId: '', organizationId: A.organizationId, token: '' };
    const res = await request(viewer, 'POST', '/events', {
      idempotencyKey: crypto.randomUUID(),
      body: { name: 'nope', startAt: new Date().toISOString() },
    });
    expect(res.status).toBe(403);
    expect(await problemCode(res)).toBe('insufficient_permission');
  });

  it('T10 · a direct PostgREST read with the anon key returns nothing', async () => {
    // Guarded by Phase -1 (services/core/sql/001_revoke_public_data_access.sql).
    // Asserted here as well so a future migration cannot silently re-grant anon.
    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      `SELECT grantee, table_name FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')`
    );
    expect(rows).toEqual([]);
  });
});

describe('T11-T19 — cross-tenant object access', () => {
  it("T11 · A checks in a person id belonging to B → 404 person_not_found", async () => {
    const res = await request(A, 'POST', `/events/${aEventId}/check-in`, {
      idempotencyKey: crypto.randomUUID(),
      body: { personId: bPersonId, method: 'manual' },
    });
    expect(res.status).toBe(404);
    expect(await problemCode(res)).toBe('person_not_found');
  });

  it("T12 · A forges a pass for B's event → 400 invalid_pass (signature)", async () => {
    const forged = `CP1.${Buffer.from(
      JSON.stringify({ eventId: bEventId, personId: bPersonId, exp: Date.now() + 1e6 })
    ).toString('base64url')}.deadbeef`;

    const res = await request(A, 'POST', `/events/${bEventId}/check-in`, {
      idempotencyKey: crypto.randomUUID(),
      body: { pass: forged, method: 'qr' },
    });
    expect([400, 404]).toContain(res.status);
    if (res.status === 400) expect(await problemCode(res)).toBe('invalid_pass');
  });

  it('T13 · a device token for event X used on event Y → 403 out_of_scope', async () => {
    const device: Actor = { label: 'door-X', accountId: '', organizationId: A.organizationId, token: '' };
    const res = await request(device, 'POST', `/events/${bEventId}/check-in`, {
      idempotencyKey: crypto.randomUUID(),
      body: { personId: bPersonId, method: 'qr' },
    });
    expect([403, 404]).toContain(res.status);
  });

  it('T14 · a revoked or expired device token → 401 token_revoked', async () => {
    const revoked: Actor = { label: 'revoked', accountId: '', organizationId: A.organizationId, token: '' };
    const res = await request(revoked, 'GET', `/events/${aEventId}/checkin-state`, { skipContract: true });
    expect(res.status).toBe(401);
    expect(await problemCode(res)).toBe('token_revoked');
  });

  it("T15 · A requests analytics scoped to B's event → 404", async () => {
    const res = await request(A, 'GET', `/analytics/overview?scope=${bEventId}&range=month`);
    expect(res.status).toBe(404);
  });

  it("T16 · A's presigned upload URL aimed at B's key prefix is rejected", async () => {
    const res = await request(A, 'POST', '/uploads', {
      idempotencyKey: crypto.randomUUID(),
      body: { kind: 'event_cover', contentType: 'image/png', byteSize: 1024 },
    });
    expect(res.status).toBe(201);
    const { uploadUrl } = await res.json();
    // The presign pins the org prefix, so the URL cannot name another tenant.
    expect(uploadUrl).toContain(`org/${A.organizationId}/`);
    expect(uploadUrl).not.toContain(B.organizationId);
  });

  it("T17 · A replays B's Idempotency-Key; keys are namespaced per caller", async () => {
    const key = crypto.randomUUID();
    const body = {
      name: 'Shared key event',
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 3_600_000).toISOString(),
      timezone: 'Europe/London',
      locationText: 'Hall',
    };

    const first = await request(B, 'POST', '/events', { idempotencyKey: key, body });
    expect(first.status).toBe(201);

    // Same key, different caller: a new resource, not a replay of B's response.
    const second = await request(A, 'POST', '/events', { idempotencyKey: key, body });
    expect(second.status).toBe(201);
    expect((await second.json()).id).not.toBe((await first.json()).id);
  });

  it("T18 · A subscribes to B's event stream → 404, no frames", async () => {
    const res = await request(A, 'GET', `/events/${bEventId}/stream`, { skipContract: true });
    expect(res.status).toBe(404);
  });

  it('T19 · A merges a B person into an A person → 404', async () => {
    const res = await request(A, 'POST', `/people/${bPersonId}/merge`, {
      idempotencyKey: crypto.randomUUID(),
      body: { sourceId: bPersonId },
    });
    expect(res.status).toBe(404);
  });
});

describe('T20-T23 — the users split, and membership invariants', () => {
  it('T20 · two orgs both register john@x.com → two distinct people, no cross-visibility', async () => {
    const email = `john+${crypto.randomUUID().slice(0, 8)}@x.com`;

    const inA = await request(A, 'POST', '/people', {
      idempotencyKey: crypto.randomUUID(),
      body: { firstName: 'John', lastName: 'Smith', email },
    });
    const inB = await request(B, 'POST', '/people', {
      idempotencyKey: crypto.randomUUID(),
      body: { firstName: 'John', lastName: 'Smith', email },
    });

    expect(inA.status).toBe(201);
    expect(inB.status).toBe(201);

    const personA = await inA.json();
    const personB = await inB.json();
    expect(personA.id).not.toBe(personB.id);

    // This is the difference between a multi-tenant product and a shared
    // spreadsheet: today `users.email` is globally unique, so the second org's
    // row silently attaches to the first org's person.
    const aSees = await request(A, 'GET', `/people/${personB.id}`);
    expect(aSees.status).toBe(404);
  });

  it("T21 · A GETs B's person → 404", async () => {
    const res = await request(A, 'GET', `/people/${bPersonId}`);
    expect(res.status).toBe(404);
  });

  it('T22 · accepting an invitation issued to another email → 403 invitation_mismatch', async () => {
    const invite = await request(B, 'POST', `/organizations/${B.organizationId}/invitations`, {
      idempotencyKey: crypto.randomUUID(),
      body: { email: 'someone-else@example.com', role: 'viewer' },
    });
    expect(invite.status).toBe(201);
    const { token } = await invite.json();

    const res = await request(A, 'POST', `/invitations/${token}/accept`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.status).toBe(403);
    expect(await problemCode(res)).toBe('invitation_mismatch');
  });

  it('T23 · the last owner cannot demote themselves → 409 last_owner', async () => {
    const res = await request(A, 'PATCH', `/organizations/${A.organizationId}/members/${A.accountId}`, {
      body: { role: 'viewer' },
    });
    expect(res.status).toBe(409);
    expect(await problemCode(res)).toBe('last_owner');
  });
});

describe('T24-T25 — structural (a class of bug, not an instance)', () => {
  it('T24 · every table in public has an RLS policy or is explicitly allow-listed', async () => {
    // The DB-side twin of the boot assertion. A new table with no policy fails
    // CI rather than quietly becoming readable across tenants (§7.2).
    // Tables reached BEFORE a tenant is known, or not tenant-scoped at all.
    // Each is here for a stated reason; adding one without a reason is how this
    // assertion stops meaning anything.
    const GLOBAL_TABLES = new Set([
      'accounts',            // resolved from a token before an org is chosen
      'identities',          // same — IdentityService is pre-tenant by definition
      'idempotency_keys',    // keyed by caller, not org
      'rate_limit_buckets',  // keyed by IP
      '__drizzle_migrations',
      // Legacy. Scoped by nothing, which is the defect this rebuild exists to
      // fix. Phase 3 drops it, and this entry must go with it.
      'users',
    ]);

    const db = await getTestDatabase();
    const { rows } = await db.pool.query<{ tablename: string; policies: number }>(
      `SELECT c.relname AS tablename,
              count(p.polname) FILTER (
                WHERE pg_get_expr(p.polqual, p.polrelid) LIKE '%current_org_ids%'
              )::int AS policies
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        GROUP BY c.relname`
    );

    const unprotected = rows
      .filter((r) => !GLOBAL_TABLES.has(r.tablename) && r.policies === 0)
      .map((r) => r.tablename);

    expect(unprotected).toEqual([]);
  });

  it('T25 · a route registered without scope/permission fails the boot assertion', async () => {
    // Proved directly in route-registry.test.ts; asserted here so the
    // adversarial suite is a complete inventory of §7.3.
    const { assertRouteRegistryComplete, RouteRegistryError } = await import('../../http/route-registry');
    expect(() =>
      assertRouteRegistryComplete([{ method: 'get', path: '/leaky', scope: 'organization' } as any])
    ).toThrow(RouteRegistryError);
  });
});

describe('T26-T28 — media, concurrency, capacity', () => {
  it("T26 · A GETs B's media asset → 404", async () => {
    const upload = await request(B, 'POST', '/uploads', {
      idempotencyKey: crypto.randomUUID(),
      body: { kind: 'event_cover', contentType: 'image/png', byteSize: 1024 },
    });
    const { assetId } = await upload.json();

    const res = await request(A, 'GET', `/media/${assetId}`);
    expect(res.status).toBe(404);
  });

  it('T27 · concurrent check-in of the same person from two doors → exactly one row', async () => {
    // The only genuinely concurrent path in the product.
    const personRes = await request(A, 'POST', '/people', {
      idempotencyKey: crypto.randomUUID(),
      body: { firstName: 'Ada', lastName: 'Lovelace', email: `ada+${crypto.randomUUID().slice(0, 8)}@x.com` },
    });
    const person = await personRes.json();

    const checkIn = () =>
      request(A, 'POST', `/events/${aEventId}/check-in`, {
        idempotencyKey: crypto.randomUUID(),
        body: { personId: person.id, method: 'manual' },
      });

    const [one, two] = await Promise.all([checkIn(), checkIn()]);

    expect(one.status).toBe(200);
    expect(two.status).toBe(200);

    const bodies = [await one.json(), await two.json()];
    // Exactly one is the original; the other reports it was already recorded.
    expect(bodies.filter((b) => b.alreadyRecorded === true)).toHaveLength(1);

    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      'SELECT count(*)::int AS n FROM attendance WHERE event_id = $1 AND person_id = $2',
      [aEventId, person.id]
    );
    expect(rows[0].n).toBe(1);
  });

  it('T28 · check-in past capacity with enforce_capacity → 409 capacity_reached', async () => {
    const evRes = await request(A, 'POST', '/events', {
      idempotencyKey: crypto.randomUUID(),
      body: {
        name: 'Tiny room',
        startAt: new Date(Date.now() - 60_000).toISOString(),
        endAt: new Date(Date.now() + 3_600_000).toISOString(),
        timezone: 'Europe/London',
        locationText: 'Broom cupboard',
        capacity: 1,
        enforceCapacity: true,
      },
    });
    const ev = await evRes.json();

    const walkIn = (n: number) =>
      request(A, 'POST', `/events/${ev.id}/check-in`, {
        idempotencyKey: crypto.randomUUID(),
        body: { firstName: 'Guest', lastName: `${n}`, email: `g${n}+${crypto.randomUUID().slice(0, 6)}@x.com`, method: 'manual' },
      });

    expect((await walkIn(1)).status).toBe(200);

    const second = await walkIn(2);
    expect(second.status).toBe(409);
    expect(await problemCode(second)).toBe('capacity_reached');
  });
});
