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

describe('resolveCaller — guest labelling', () => {
  it('gives an anonymous caller a readable display name', async () => {
    const caller = await resolveCaller(db, input(`sub-${crypto.randomUUID()}`, { is_anonymous: true }));

    expect(caller.isGuest).toBe(true);
    expect(caller.displayName).toMatch(/^Guest \d{4}$/);
  });

  it('prefers the name the provider asserts over the generated label', async () => {
    const caller = await resolveCaller(
      db,
      input(`sub-${crypto.randomUUID()}`, { is_anonymous: true, name: 'Ada Lovelace' })
    );

    expect(caller.displayName).toBe('Ada Lovelace');
  });

  it('does not label a non-guest', async () => {
    const caller = await resolveCaller(
      db,
      input(`sub-${crypto.randomUUID()}`, { email: 'someone@example.com' })
    );

    expect(caller.isGuest).toBe(false);
    expect(caller.displayName).toBeNull();
  });

  it('creates no membership — a new account belongs to nothing (D16)', async () => {
    const caller = await resolveCaller(db, input(`sub-${crypto.randomUUID()}`, { is_anonymous: true }));
    expect(caller.memberships).toHaveLength(0);
  });
});
