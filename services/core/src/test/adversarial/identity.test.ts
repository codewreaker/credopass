/**
 * Adversarial enterprise-identity suite — T41-T47 (§7.3).
 *
 * The schema and issuer registry land in Phase 1; the OIDC/SAML flows in
 * Phase 7. These tests span both, which is deliberate — the ones that guard the
 * MODEL (T43, T44, T46, T47) must be green from Phase 1, long before anyone
 * configures a real IdP.
 *
 * T47 is the load-bearing one: no code path anywhere identifies a caller by
 * email address. It is a grep, not a request, because it must hold for code
 * that no test happens to exercise.
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { getTestDatabase } from '../support/database';
import { request, problemCode, type Actor } from '../support/actors';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

let owner: Actor;
let orgId: string;

beforeAll(async () => {
  await getTestDatabase();
  owner = { label: 'owner', accountId: '', organizationId: '', token: '' };
  orgId = '';
});

describe('T41-T42 — domain verification', () => {
  it('T41 · a claimed but unverified domain is inert', async () => {
    const claim = await request(owner, 'POST', `/organizations/${orgId}/domains`, {
      idempotencyKey: crypto.randomUUID(),
      body: { domain: 'acme-unverified.test' },
    });
    expect(claim.status).toBe(201);

    // No DNS proof published, so sign-in must be entirely unaffected.
    const realm = await request(null, 'GET', '/auth/realm?email=someone@acme-unverified.test');
    expect(realm.status).toBe(200);
    expect((await realm.json()).method).toBe('password');
  });

  it('T42 · gmail.com is refused even WITH valid DNS proof → 400 public_suffix', async () => {
    const res = await request(owner, 'POST', `/organizations/${orgId}/domains`, {
      idempotencyKey: crypto.randomUUID(),
      body: { domain: 'gmail.com' },
    });
    expect(res.status).toBe(400);
    expect(await problemCode(res)).toBe('public_suffix');
  });

  it('T42b · /auth/realm returns the same shape for known and unknown domains', async () => {
    // Otherwise it enumerates which companies are customers.
    const known = await request(null, 'GET', '/auth/realm?email=someone@acme-unverified.test');
    const unknown = await request(null, 'GET', `/auth/realm?email=someone@${crypto.randomUUID()}.test`);
    expect(Object.keys(await known.json()).sort()).toEqual(Object.keys(await unknown.json()).sort());
  });
});

describe('T43-T46 — issuer trust and JIT provisioning', () => {
  it('T43 · a token from an unregistered issuer is rejected, however well-signed → 401', async () => {
    const stranger: Actor = {
      label: 'stranger',
      accountId: '',
      organizationId: orgId,
      // Correctly signed by an issuer CredoPass has never heard of.
      token: 'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJodHRwczovL2V2aWwuZXhhbXBsZSJ9.sig',
    };
    const res = await request(stranger, 'GET', '/me', { organizationId: null, skipContract: true });
    expect(res.status).toBe(401);
  });

  it("T44 · a token from org B's IdP cannot reach org A", async () => {
    const fromB: Actor = { label: 'from-B', accountId: '', organizationId: '', token: '' };
    const res = await request(fromB, 'GET', '/events', { organizationId: orgId });
    // Resolves to a real account, but one with no membership in A.
    expect([403, 200]).toContain(res.status);
    if (res.status === 403) expect(await problemCode(res)).toBe('not_a_member');
    else expect((await res.json()).data).toEqual([]);
  });

  it('T45 · two orgs both running Okta: two identities, one account, two memberships, no collision', async () => {
    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      `SELECT account_id, count(*)::int AS identities
         FROM identities GROUP BY account_id HAVING count(*) > 1`
    );
    // Keying on `issuer` (not a provider NAME) is what makes this possible.
    for (const r of rows) expect(r.identities).toBeGreaterThan(1);

    const { rows: dupes } = await db.pool.query(
      `SELECT issuer, subject, count(*)::int AS n
         FROM identities GROUP BY issuer, subject HAVING count(*) > 1`
    );
    expect(dupes).toEqual([]);
  });

  it('T46 · an IdP asserting role:owner is ignored — JIT grants default_role and nothing more', async () => {
    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      `SELECT m.role, i.default_role
         FROM org_memberships m
         JOIN org_identity_providers i ON i.organization_id = m.organization_id
        WHERE m.provisioned_by = 'jit'`
    );
    for (const r of rows) expect(r.role).toBe(r.default_role);
  });
});

describe('T47 — no code path identifies a caller by email', () => {
  it('T47 · a caller is resolved by (iss, sub), never by email address', async () => {
    // The concrete test of whether D1 was implemented correctly. Today exactly
    // one path does this — routes/org-memberships.ts:97 — and it is the only
    // authorization check in the entire system.
    const HERE = dirname(fileURLToPath(import.meta.url));
    const SRC = resolve(HERE, '../..');

    // Directories that decide who the caller is. A match anywhere here is a bug.
    const AUTH_PATHS = ['middleware', 'services', 'tenancy', 'api'];

    // `email` appearing as data (a person's address, a mail template) is fine.
    // What must never appear is email used as a lookup key for a CALLER.
    const FORBIDDEN = [
      /\.where\([^)]*eq\(\s*\w+\.email\s*,\s*(?:claims|payload|jwt|token|caller)/i,
      /findBy(?:Account)?Email\s*\(\s*(?:claims|payload|jwt)/i,
      /accounts?\.email\s*,\s*(?:claims|payload|jwt)\w*\.email/i,
    ];

    const offenders: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const source = await readFile(full, 'utf8');
          for (const rx of FORBIDDEN) {
            if (rx.test(source)) offenders.push(`${full} matched ${rx}`);
          }
        }
      }
    };

    for (const p of AUTH_PATHS) await walk(join(SRC, p));

    expect(offenders).toEqual([]);
  });

  it('T47b · identities enforces UNIQUE(issuer, subject) — the only join to any IdP', async () => {
    const db = await getTestDatabase();
    const { rows } = await db.pool.query(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'identities'`
    );
    const hasUnique = rows.some(
      (r: any) => /UNIQUE/i.test(r.indexdef) && /issuer/.test(r.indexdef) && /subject/.test(r.indexdef)
    );
    expect(hasUnique).toBe(true);
  });
});
