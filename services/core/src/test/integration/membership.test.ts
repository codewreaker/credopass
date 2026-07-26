/**
 * MembershipService against a real Postgres.
 *
 * These exercise the invariants directly, without HTTP, because that is where
 * they live (§4.2). The adversarial suite covers the same rules from the
 * outside once the endpoints are reachable with real tokens.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { getTestDatabase, type TestDatabase } from '../support/database';
import * as Membership from '../../services/membership';
import { accounts, identities, orgMemberships } from '@credopass/lib/schemas/tables';
import { eq } from 'drizzle-orm';

let harness: TestDatabase;
let db: any;

const newAccount = async (email: string, verified = true): Promise<string> => {
  const [account] = await db.insert(accounts).values({ email }).returning({ id: accounts.id });
  await db.insert(identities).values({
    accountId: account.id,
    issuer: 'https://test.local/auth/v1',
    subject: `sub-${crypto.randomUUID()}`,
    providerKind: 'supabase',
    email,
    emailVerified: verified,
  });
  return account.id;
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

describe('createOrganization', () => {
  it('makes the creator an owner in the same transaction', async () => {
    const accountId = await newAccount('founder@example.com');
    const org = await Membership.createOrganization(db, accountId, { name: 'Kharis Church' });

    expect(org.role).toBe('owner');
    expect(org.slug).toBe('kharis-church');

    const members = await Membership.listMembers(db, org.id);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('owner');
    expect(members[0].accountId).toBe(accountId);
  });

  it('forces plan to free however hard the client tries', async () => {
    const accountId = await newAccount('founder2@example.com');
    const org = await Membership.createOrganization(db, accountId, {
      name: 'Enterprise Wannabe',
      // @ts-expect-error — not part of the input type, and must be ignored anyway
      plan: 'enterprise',
    });
    expect(org.plan).toBe('free');
  });

  it('refuses a duplicate slug', async () => {
    const a = await newAccount('a@example.com');
    await Membership.createOrganization(db, a, { name: 'Same Name' });
    await expect(
      Membership.createOrganization(db, a, { name: 'Same Name' })
    ).rejects.toThrow(/already in use/);
  });

  it('lists only the caller\'s organizations, never everyone\'s (T1)', async () => {
    const a = await newAccount('a2@example.com');
    const b = await newAccount('b2@example.com');

    await Membership.createOrganization(db, a, { name: 'A Org' });
    await Membership.createOrganization(db, b, { name: 'B Org' });

    const forA = await Membership.listMyOrganizations(db, a);
    expect(forA).toHaveLength(1);
    expect(forA[0].name).toBe('A Org');
  });
});

describe('role changes (T23)', () => {
  it('refuses to demote the last owner', async () => {
    const accountId = await newAccount('solo@example.com');
    const org = await Membership.createOrganization(db, accountId, { name: 'Solo Org' });

    await expect(
      Membership.changeRole(db, org.id, 'owner', accountId, 'viewer')
    ).rejects.toThrow(/only owner/i);
  });

  it('allows demotion once a second owner exists', async () => {
    const first = await newAccount('first@example.com');
    const second = await newAccount('second@example.com');
    const org = await Membership.createOrganization(db, first, { name: 'Two Owners' });

    await db.insert(orgMemberships).values({
      organizationId: org.id,
      accountId: second,
      role: 'owner',
      status: 'active',
    });

    const updated = await Membership.changeRole(db, org.id, 'owner', first, 'viewer');
    expect(updated.role).toBe('viewer');
  });

  it('refuses to grant a role above your own', async () => {
    const owner = await newAccount('owner3@example.com');
    const member = await newAccount('member3@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Escalation Test' });

    await db.insert(orgMemberships).values({
      organizationId: org.id,
      accountId: member,
      role: 'organizer',
      status: 'active',
    });

    // An admin trying to mint an owner.
    await expect(
      Membership.changeRole(db, org.id, 'admin', member, 'owner')
    ).rejects.toThrow(/above your own/);
  });

  it('refuses to let an admin change an owner', async () => {
    const owner = await newAccount('owner4@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Admin Limits' });

    await expect(
      Membership.changeRole(db, org.id, 'admin', owner, 'viewer')
    ).rejects.toThrow(/Only an owner/);
  });

  it('refuses to remove the last owner', async () => {
    const owner = await newAccount('owner5@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Last Owner' });

    await expect(Membership.removeMember(db, org.id, 'owner', owner)).rejects.toThrow(
      /at least one owner/
    );
  });
});

describe('invitations (T22, D-B)', () => {
  it('issues a token once and stores only its hash', async () => {
    const owner = await newAccount('inviter@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Invite Org' });

    const invite = await Membership.inviteMember(db, org.id, 'owner', owner, {
      email: 'newcomer@example.com',
      role: 'organizer',
    });

    expect(invite.token.length).toBeGreaterThan(32);

    const { invitations } = await import('@credopass/lib/schemas/tables');
    const [row] = await db.select().from(invitations).where(eq(invitations.id, invite.id));
    // The raw token must never be recoverable from the database.
    expect(row.tokenHash).not.toBe(invite.token);
    expect(JSON.stringify(row)).not.toContain(invite.token);
  });

  it('refuses to invite above your own role', async () => {
    const admin = await newAccount('admin6@example.com');
    const org = await Membership.createOrganization(db, admin, { name: 'Invite Limits' });

    await expect(
      Membership.inviteMember(db, org.id, 'admin', admin, {
        email: 'x@example.com',
        role: 'owner',
      })
    ).rejects.toThrow(/above your own/);
  });

  it('T22 · refuses acceptance from a different email address', async () => {
    const owner = await newAccount('owner7@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Mismatch Org' });

    const invite = await Membership.inviteMember(db, org.id, 'owner', owner, {
      email: 'intended@example.com',
      role: 'viewer',
    });

    const interloper = await newAccount('interloper@example.com');
    await expect(
      Membership.acceptInvitation(db, interloper, ['interloper@example.com'], invite.token)
    ).rejects.toThrow(/different email/);

    // And no membership was created as a side effect.
    const members = await Membership.listMembers(db, org.id);
    expect(members.map((m) => m.accountId)).not.toContain(interloper);
  });

  it('accepts from the intended address and creates the membership', async () => {
    const owner = await newAccount('owner8@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Accept Org' });

    const invite = await Membership.inviteMember(db, org.id, 'owner', owner, {
      email: 'invited@example.com',
      role: 'organizer',
    });

    const invited = await newAccount('invited@example.com');
    const result = await Membership.acceptInvitation(
      db,
      invited,
      ['Invited@Example.com'], // case-insensitive
      invite.token
    );

    expect(result.organizationId).toBe(org.id);
    expect(result.role).toBe('organizer');

    const members = await Membership.listMembers(db, org.id);
    expect(members).toHaveLength(2);
  });

  it('refuses a second acceptance of the same token', async () => {
    const owner = await newAccount('owner9@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Replay Org' });
    const invite = await Membership.inviteMember(db, org.id, 'owner', owner, {
      email: 'once@example.com',
      role: 'viewer',
    });

    const invited = await newAccount('once@example.com');
    await Membership.acceptInvitation(db, invited, ['once@example.com'], invite.token);

    await expect(
      Membership.acceptInvitation(db, invited, ['once@example.com'], invite.token)
    ).rejects.toThrow(/already been accepted/);
  });

  it('refuses a revoked invitation', async () => {
    const owner = await newAccount('owner10@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Revoke Org' });
    const invite = await Membership.inviteMember(db, org.id, 'owner', owner, {
      email: 'revoked@example.com',
      role: 'viewer',
    });

    await Membership.revokeInvitation(db, org.id, invite.id);

    const invited = await newAccount('revoked@example.com');
    await expect(
      Membership.acceptInvitation(db, invited, ['revoked@example.com'], invite.token)
    ).rejects.toThrow(/not valid/);
  });
});

describe('deleteOrganization', () => {
  it('refuses while events exist', async () => {
    const owner = await newAccount('owner11@example.com');
    const org = await Membership.createOrganization(db, owner, { name: 'Has Events' });

    const { events } = await import('@credopass/lib/schemas/tables');
    await db.insert(events).values({
      organizationId: org.id,
      name: 'A meeting',
      startAt: new Date(),
      endAt: new Date(Date.now() + 3_600_000),
      locationText: 'Hall',
      shortCode: crypto.randomUUID().slice(0, 12),
    });

    await expect(Membership.deleteOrganization(db, org.id)).rejects.toThrow(/still has 1 event/);
  });
});
