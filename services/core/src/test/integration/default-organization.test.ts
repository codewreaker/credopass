/**
 * Auto-provisioning the first organisation.
 *
 * This replaced the onboarding wall, so the properties that matter are the ones
 * a wall used to guarantee by hand: exactly one organisation, exactly one
 * owner, and no second one on any later request. Concurrency is the interesting
 * case — a first page load fires several requests at once, and all of them see
 * "no memberships".
 *
 * Needs a real Postgres: the guard is `pg_advisory_xact_lock`, which cannot be
 * faked.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import {
  createOrganization,
  defaultOrganizationName,
  ensureDefaultOrganization,
} from '../../services/membership';
import { orgMemberships, organizations } from '@credopass/lib/schemas/tables';
import { accounts } from '@credopass/lib/schemas/tables';
import { eq } from 'drizzle-orm';

let harness: TestDatabase;
let db: any;

const newAccount = async (displayName: string | null, email: string | null) => {
  const [row] = await db
    .insert(accounts)
    .values({ displayName, email, lastSeenAt: new Date() })
    .returning({ id: accounts.id });
  return { id: row.id, displayName, email };
};

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

describe('defaultOrganizationName', () => {
  it("uses the person's first name", () => {
    expect(defaultOrganizationName('Israel Agyeman-Prempeh', null)).toBe("Israel's organization");
  });

  it('falls back to the email local part when no name was asserted', () => {
    // Anonymous-adjacent providers assert no `name`; the whole address as an
    // organisation name would be worse than a first name guess.
    expect(defaultOrganizationName(null, 'ada.lovelace@example.com')).toBe("Ada's organization");
  });

  it('still produces something usable with neither', () => {
    expect(defaultOrganizationName(null, null)).toBe('My organization');
  });
});

describe('ensureDefaultOrganization', () => {
  it('gives a new account one organisation, owned by them', async () => {
    const account = await newAccount('Israel Agyeman-Prempeh', 'israel@example.test');

    const org = await ensureDefaultOrganization(db, account);
    expect(org?.name).toBe("Israel's organization");
    expect(org?.role).toBe('owner');
    expect(org?.plan).toBe('free');

    const members = await db
      .select({ role: orgMemberships.role })
      .from(orgMemberships)
      .where(eq(orgMemberships.accountId, account.id));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('owner');
  });

  it('does nothing on later calls — no second organisation', async () => {
    const account = await newAccount('Israel', 'israel@example.test');

    const first = await ensureDefaultOrganization(db, account);
    const second = await ensureDefaultOrganization(db, account);
    const third = await ensureDefaultOrganization(db, account);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(third).toBeNull();

    const all = await db.select({ id: organizations.id }).from(organizations);
    expect(all).toHaveLength(1);
  });

  it('creates exactly one organisation under concurrent first requests', async () => {
    const account = await newAccount('Israel', 'israel@example.test');

    // What a real first page load does.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => ensureDefaultOrganization(db, account))
    );

    // Exactly one request did the work; the rest correctly did nothing.
    expect(results.filter((r) => r !== null)).toHaveLength(1);

    const orgs = await db.select({ id: organizations.id }).from(organizations);
    expect(orgs).toHaveLength(1);

    const members = await db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(eq(orgMemberships.accountId, account.id));
    expect(members).toHaveLength(1);
  });

  it('gives two people with the same name distinct slugs', async () => {
    // `organizations.slug` is globally unique, so a common first name must not
    // make the second person's sign-in fail.
    const one = await newAccount('Israel', 'one@example.test');
    const two = await newAccount('Israel', 'two@example.test');

    const a = await ensureDefaultOrganization(db, one);
    const b = await ensureDefaultOrganization(db, two);

    expect(a?.name).toBe(b?.name);
    expect(a?.slug).not.toBe(b?.slug);
  });
});

describe('plan limits on createOrganization', () => {
  it('lets a free account create exactly one more, then answers 402', async () => {
    const account = await newAccount('Israel', 'israel@example.test');
    await ensureDefaultOrganization(db, account);

    // The one the free tier includes.
    await createOrganization(db, account.id, { name: 'Second Org' });

    // The one it does not.
    let status: number | undefined;
    let code: string | undefined;
    try {
      await createOrganization(db, account.id, { name: 'Third Org' });
    } catch (error) {
      status = (error as { status?: number }).status;
      code = (error as { code?: string }).code;
    }

    expect(status).toBe(402);
    expect(code).toBe('plan_limit');

    const owned = await db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(eq(orgMemberships.accountId, account.id));
    expect(owned).toHaveLength(2);
  });

  it('does not count organisations someone else owns you into', async () => {
    // Being invited must cost the invitee nothing, or a popular volunteer runs
    // out of allowance for organisations they did not create.
    const owner = await newAccount('Owner', 'owner@example.test');
    const guestUser = await newAccount('Helper', 'helper@example.test');

    await ensureDefaultOrganization(db, owner);
    await ensureDefaultOrganization(db, guestUser);

    const ownersOrg = await createOrganization(db, owner.id, { name: 'Shared Org' });
    await db.insert(orgMemberships).values({
      organizationId: ownersOrg.id,
      accountId: guestUser.id,
      role: 'admin',
      status: 'active',
      provisionedBy: 'manual',
    });

    // The helper owns only their own auto-provisioned org, so one slot remains.
    await createOrganization(db, guestUser.id, { name: "Helper's Second" });

    const ownedByHelper = await db
      .select({ role: orgMemberships.role })
      .from(orgMemberships)
      .where(eq(orgMemberships.accountId, guestUser.id));
    expect(ownedByHelper.filter((m: any) => m.role === 'owner')).toHaveLength(2);
  });
});
