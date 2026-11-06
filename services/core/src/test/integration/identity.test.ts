/**
 * `resolveCaller` against a real Postgres — specifically its behaviour under
 * concurrency, which is where it was broken.
 *
 * A brand-new caller's first page load fires several requests at once. Every
 * one of them misses the "does this identity exist?" SELECT, and every one of
 * them tries to insert. Before the fix, `uq_identities_issuer_subject` rejected
 * all but one and the losers answered 500 — reproduced live as 3 of 4 failing
 * on a new user's very first request.
 *
 * This needs a real database: the bug IS the unique index, so it cannot be
 * caught by a unit test with a fake.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import { resolveCaller, type ResolveInput } from '../../services/identity';
import { accounts, identities } from '@credopass/lib/schemas/tables';
import { and, eq, sql } from 'drizzle-orm';

let harness: TestDatabase;
let db: any;

const ISSUER = 'https://test.local/auth/v1';

const input = (subject: string, claims: Record<string, unknown> = {}): ResolveInput => ({
  issuer: ISSUER,
  subject,
  claims,
  providerKind: 'supabase',
});

beforeAll(async () => {
  harness = await getTestDatabase();
  db = harness.db;
});

beforeEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.stop();
});

describe('resolveCaller — concurrency on first sight', () => {
  it('answers every concurrent first request, and creates exactly one account', async () => {
    const subject = `sub-${crypto.randomUUID()}`;

    const callers = await Promise.all(
      Array.from({ length: 8 }, () => resolveCaller(db, input(subject)))
    );

    // Every request succeeded...
    expect(callers).toHaveLength(8);

    // ...and they all agree on who the caller is.
    const ids = new Set(callers.map((c) => c.accountId));
    expect(ids.size).toBe(1);

    const rows = await db
      .select({ id: identities.id })
      .from(identities)
      .where(and(eq(identities.issuer, ISSUER), eq(identities.subject, subject)));
    expect(rows).toHaveLength(1);
  });

  it('leaves no orphan account behind when a race is lost', async () => {
    const subject = `sub-${crypto.randomUUID()}`;
    await Promise.all(Array.from({ length: 8 }, () => resolveCaller(db, input(subject))));

    // The losing transactions each inserted an account before hitting the
    // conflict. If they did not roll back, those accounts survive with nothing
    // pointing at them.
    const [orphans] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(accounts)
      .where(sql`not exists (select 1 from ${identities} where ${identities.accountId} = ${accounts.id})`);

    expect(orphans.n).toBe(0);
  });

  it('is stable across repeated calls — no second account on later requests', async () => {
    const subject = `sub-${crypto.randomUUID()}`;

    const first = await resolveCaller(db, input(subject));
    const second = await resolveCaller(db, input(subject));
    const third = await resolveCaller(db, input(subject));

    expect(second.accountId).toBe(first.accountId);
    expect(third.accountId).toBe(first.accountId);

    const all = await db.select({ id: accounts.id }).from(accounts);
    expect(all).toHaveLength(1);
  });

  it('keeps distinct subjects distinct under concurrency', async () => {
    const subjects = Array.from({ length: 4 }, () => `sub-${crypto.randomUUID()}`);

    // Four identities, each raced four ways at the same time.
    const callers = await Promise.all(
      subjects.flatMap((s) => Array.from({ length: 4 }, () => resolveCaller(db, input(s))))
    );

    expect(new Set(callers.map((c) => c.accountId)).size).toBe(4);
  });
});

/**
 * A second provider identity asserting an address another account already
 * holds.
 *
 * This is one human with two identities — a password sign-up and the GitHub
 * button, or (the case that found it) a Supabase user recreated under a new
 * `sub`. `uq_accounts_email` rejected the account insert, nothing caught it,
 * and EVERY authenticated request they made answered 500: `/me/context`,
 * `/organizations`, `POST /events`, all of it. The console looked like a broken
 * API when the real fault was one unique index on a mirrored column.
 *
 * The invariant the fix must not break is the one at the top of
 * `services/identity.ts`: a caller is identified by (issuer, subject), NEVER by
 * email. So the second identity gets its OWN account — it does not attach to
 * the first — and the address simply stops being mirrored onto the new row.
 */
describe('resolveCaller — an address another account already holds', () => {
  const EMAIL = 'two.identities@example.com';

  it('creates a separate account instead of raising on uq_accounts_email', async () => {
    const first = await resolveCaller(db, input(`sub-${crypto.randomUUID()}`, { email: EMAIL }));
    const second = await resolveCaller(db, input(`sub-${crypto.randomUUID()}`, { email: EMAIL }));

    // The whole bug: this call used to throw.
    expect(second.accountId).not.toBe(first.accountId);

    // Identity, not email, is what separates them.
    const rows = await db.select({ id: accounts.id, email: accounts.email }).from(accounts);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r: { email: string | null }) => r.email === EMAIL)).toHaveLength(1);
  });

  it('keeps the asserted address on the identity row, and reports it to the caller', async () => {
    await resolveCaller(db, input(`sub-${crypto.randomUUID()}`, { email: EMAIL }));

    const subject = `sub-${crypto.randomUUID()}`;
    const second = await resolveCaller(db, input(subject, { email: EMAIL, email_verified: true }));

    // Nothing the provider asserted is lost, even though the account row could
    // not mirror it.
    const [identity] = await db
      .select({ email: identities.email, verified: identities.emailVerified })
      .from(identities)
      .where(and(eq(identities.issuer, ISSUER), eq(identities.subject, subject)));

    expect(identity.email).toBe(EMAIL);
    expect(identity.verified).toBe(true);
    expect(second.email).toBe(EMAIL);
  });

  it('answers every concurrent request when several identities assert one address', async () => {
    const subjects = Array.from({ length: 6 }, () => `sub-${crypto.randomUUID()}`);

    // All six first-sightings at once, every one claiming the same address —
    // the race the pre-flight check alone cannot win.
    const callers = await Promise.all(
      subjects.map((s) => resolveCaller(db, input(s, { email: EMAIL })))
    );

    expect(new Set(callers.map((c) => c.accountId)).size).toBe(6);

    const mirrored = await db
      .select({ email: accounts.email })
      .from(accounts)
      .where(sql`lower(${accounts.email}) = ${EMAIL}`);
    expect(mirrored).toHaveLength(1);
  });
});
