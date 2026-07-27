/**
 * MembershipService — organisations, memberships, roles, invitations.
 * docs/API-FIRST-REBUILD.md §4.2
 *
 * Invariants, all enforced here rather than by the caller remembering them:
 *
 *   · Creating an org creates the caller's `owner` membership IN THE SAME
 *     TRANSACTION. An org with no owner is unreachable and unrecoverable.
 *   · An org always has ≥1 owner. The last one cannot be demoted or removed.
 *   · Nobody may grant a role above their own.
 *   · An admin may not change or remove an owner.
 *
 * No framework imports (rule 3).
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import {
  accounts,
  events,
  invitations,
  orgMemberships,
  organizations,
} from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import { ProblemCode, problem } from '../http/problem';
import type { OrgRole } from '../authz/permissions';
import { DEFAULT_PLAN, orgLimitFor } from '../authz/plans';
import { normaliseRole } from './identity';

/**
 * Role seniority. Used for two checks that are easy to get wrong:
 * "may I grant this role?" and "may I act on this member?".
 * `viewer` and `checkin` are both leaves — neither outranks the other.
 */
const RANK: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  organizer: 2,
  checkin: 1,
  viewer: 1,
};

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'org';

/**
 * Create an organisation and make the caller its owner.
 *
 * The membership is written in the same transaction as the organisation. If
 * that second insert fails, the organisation must not exist — otherwise it is
 * an orphan nobody can administer, delete or even see.
 */
export async function createOrganization(
  db: Database,
  accountId: string,
  input: { id?: string; name: string; slug?: string; timezone?: string }
): Promise<OrganizationSummary> {
  await assertCanOwnAnother(db, accountId);

  const slug = slugify(input.slug ?? input.name);

  const clash = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (clash.length > 0) {
    throw problem.conflict(ProblemCode.SLUG_TAKEN, `The slug "${slug}" is already in use.`);
  }

  return insertOrganization(db, accountId, { ...input, slug });
}

/**
 * The org + owner-membership pair, written together.
 *
 * Split out because auto-provisioning needs exactly this and must NOT re-run
 * the quota check — the first organisation is granted, not purchased.
 */
async function insertOrganization(
  db: Database,
  accountId: string,
  input: { id?: string; name: string; slug: string }
): Promise<OrganizationSummary> {
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        ...(input.id ? { id: input.id } : {}),
        name: input.name,
        slug: input.slug,
        // `plan` is server-forced. A client that sends "enterprise" gets free.
        plan: DEFAULT_PLAN,
      })
      .returning();

    await tx.insert(orgMemberships).values({
      organizationId: org.id,
      accountId,
      role: 'owner',
      status: 'active',
      provisionedBy: 'manual',
    });

    return { id: org.id, name: org.name, slug: org.slug, plan: org.plan, role: 'owner' as const };
  });
}

/** Organisations this account owns, with their plans. */
async function ownedOrganizations(db: Database, accountId: string) {
  return db
    .select({ id: organizations.id, plan: organizations.plan })
    .from(orgMemberships)
    .innerJoin(organizations, eq(organizations.id, orgMemberships.organizationId))
    .where(
      and(
        eq(orgMemberships.accountId, accountId),
        eq(orgMemberships.role, 'owner'),
        eq(orgMemberships.status, 'active'),
        isNull(organizations.deletedAt)
      )
    );
}

/**
 * Enforce the per-plan cap on organisations an account may own.
 *
 * 402, not 403: the caller is not forbidden, they have run out of allowance —
 * and 402 is what the upgrade screen keys off. The detail names both numbers so
 * the UI never has to guess what the limit was.
 */
async function assertCanOwnAnother(db: Database, accountId: string): Promise<void> {
  const owned = await ownedOrganizations(db, accountId);
  const limit = orgLimitFor(owned.map((o) => o.plan ?? DEFAULT_PLAN));

  if (owned.length >= limit) {
    throw problem.paymentRequired(
      ProblemCode.PLAN_LIMIT,
      `Your plan includes ${limit} organization${limit === 1 ? '' : 's'} and you already own ${owned.length}. Upgrade to create more.`
    );
  }
}

/** `Israel's organization`, from whatever the identity provider told us. */
export function defaultOrganizationName(
  displayName: string | null,
  email: string | null
): string {
  const fromName = displayName?.trim().split(/\s+/)[0];
  // Local-part fallback: `ada.lovelace@x.com` reads better as "Ada" than as the
  // whole address, and an account with neither name nor email is possible.
  const fromEmail = email?.split('@')[0]?.split(/[._-]/)[0];
  const raw = fromName || fromEmail;
  if (!raw) return 'My organization';

  const who = raw.charAt(0).toUpperCase() + raw.slice(1);
  return `${who}'s organization`;
}

/**
 * Give a brand-new account its own organisation.
 *
 * Runs on first sign-in and never again — the membership it creates is what
 * makes the check below false forever after. This is what replaced the
 * onboarding wall: with anonymous sign-in gone, every account belongs to a real
 * authenticated person, so there is no drive-by visitor to provision for.
 *
 * Two hazards, both handled:
 *
 *   · CONCURRENCY. A first page load fires several requests at once and every
 *     one of them would see "no memberships" and create an organisation. The
 *     advisory lock serialises them per account, and the re-check inside the
 *     lock means the losers do nothing. The lock is transaction-scoped, so it
 *     is released even if this throws.
 *   · SLUG COLLISION. Two people called Israel produce the same slug, and the
 *     column is globally unique. A suffix is appended until one is free rather
 *     than failing a sign-in over a name nobody chose.
 *
 * Returns the organisation it created, or null when the account already had one.
 */
export async function ensureDefaultOrganization(
  db: Database,
  account: { id: string; displayName: string | null; email: string | null }
): Promise<OrganizationSummary | null> {
  return db.transaction(async (tx) => {
    // Serialise concurrent first requests for THIS account only. hashtext gives
    // a stable bigint from the uuid; collisions across accounts are harmless
    // here because the worst case is one extra request waiting briefly.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${account.id}))`);

    // Same join as `loadMemberships`, for the same reason: a membership pointing
    // at a soft-deleted organisation is not an organisation. Without it, an
    // account whose only org was deleted would be told it already has one and
    // then 403 on every org-scoped route — stuck, with no way back.
    const existing = await tx
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .innerJoin(organizations, eq(organizations.id, orgMemberships.organizationId))
      .where(
        and(
          eq(orgMemberships.accountId, account.id),
          eq(orgMemberships.status, 'active'),
          isNull(organizations.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) return null;

    const name = defaultOrganizationName(account.displayName, account.email);
    const base = slugify(name);

    let slug = base;
    for (let attempt = 0; attempt < 25; attempt++) {
      const taken = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      if (taken.length === 0) break;
      slug = `${base}-${randomBytes(3).toString('hex')}`;
    }

    const [org] = await tx
      .insert(organizations)
      .values({ name, slug, plan: DEFAULT_PLAN })
      .returning();

    await tx.insert(orgMemberships).values({
      organizationId: org.id,
      accountId: account.id,
      role: 'owner',
      status: 'active',
      provisionedBy: 'manual',
    });

    return { id: org.id, name: org.name, slug: org.slug, plan: org.plan, role: 'owner' as const };
  });
}

/** The caller's organisations — never every organisation in the database. */
export async function listMyOrganizations(
  db: Database,
  accountId: string
): Promise<OrganizationSummary[]> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      role: orgMemberships.role,
    })
    .from(orgMemberships)
    .innerJoin(organizations, eq(organizations.id, orgMemberships.organizationId))
    .where(
      and(
        eq(orgMemberships.accountId, accountId),
        eq(orgMemberships.status, 'active'),
        isNull(organizations.deletedAt)
      )
    );

  return rows.map((r) => ({ ...r, role: normaliseRole(r.role) }));
}

export async function getOrganization(db: Database, organizationId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)))
    .limit(1);

  if (!org) throw problem.notFound(ProblemCode.NOT_FOUND, 'Organization not found.');
  return org;
}

export async function updateOrganization(
  db: Database,
  organizationId: string,
  patch: { name?: string; slug?: string }
) {
  await getOrganization(db, organizationId);

  if (patch.slug) {
    const clash = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.slug, slugify(patch.slug)), sql`${organizations.id} <> ${organizationId}`))
      .limit(1);
    if (clash.length > 0) throw problem.conflict(ProblemCode.SLUG_TAKEN);
  }

  const [updated] = await db
    .update(organizations)
    .set({
      ...(patch.name ? { name: patch.name } : {}),
      ...(patch.slug ? { slug: slugify(patch.slug) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  return updated;
}

/**
 * Soft delete. Two refusals:
 *
 *   · while events exist — deleting an organisation with attendance history
 *     attached destroys the record the product exists to keep;
 *   · while it is the caller's ONLY organisation.
 *
 * The second is the counterpart of `ensureDefaultOrganization`. Signing in
 * commissions an organisation and that is the whole of onboarding (D22), so
 * there is no orgless state for the console to render and no screen that offers
 * a way out of one. Deleting your last organisation therefore either strands
 * you or silently hands you a fresh auto-provisioned one on the next request —
 * both worse than saying no. Rename it, or create the replacement first.
 */
export async function deleteOrganization(
  db: Database,
  organizationId: string,
  accountId: string
): Promise<void> {
  await getOrganization(db, organizationId);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.organizationId, organizationId), isNull(events.deletedAt)));

  if (count > 0) {
    throw problem.conflict(
      ProblemCode.HAS_EVENTS,
      `This organization still has ${count} event(s). Delete them first.`
    );
  }

  // Checked second, and deliberately: "delete the events first" is the more
  // specific instruction, and an org with events is the commoner case.
  const others = await db
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .innerJoin(organizations, eq(organizations.id, orgMemberships.organizationId))
    .where(
      and(
        eq(orgMemberships.accountId, accountId),
        eq(orgMemberships.status, 'active'),
        isNull(organizations.deletedAt),
        sql`${organizations.id} <> ${organizationId}`
      )
    )
    .limit(1);

  if (others.length === 0) {
    throw problem.conflict(
      ProblemCode.LAST_ORGANIZATION,
      'This is your only organization. Create another one first, or rename this one.'
    );
  }

  await db
    .update(organizations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));
}

export interface MemberRow {
  accountId: string;
  email: string | null;
  displayName: string | null;
  role: OrgRole;
  status: string;
  createdAt: Date;
}

export async function listMembers(db: Database, organizationId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({
      accountId: orgMemberships.accountId,
      email: accounts.email,
      displayName: accounts.displayName,
      role: orgMemberships.role,
      status: orgMemberships.status,
      createdAt: orgMemberships.createdAt,
    })
    .from(orgMemberships)
    .innerJoin(accounts, eq(accounts.id, orgMemberships.accountId))
    .where(eq(orgMemberships.organizationId, organizationId));

  return rows.map((r) => ({
    ...r,
    accountId: r.accountId!,
    role: normaliseRole(r.role),
  }));
}

const countOwners = async (db: Database, organizationId: string): Promise<number> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgMemberships)
    .where(
      and(
        eq(orgMemberships.organizationId, organizationId),
        eq(orgMemberships.role, 'owner'),
        eq(orgMemberships.status, 'active')
      )
    );
  return count;
};

const findMembership = async (db: Database, organizationId: string, accountId: string) => {
  const [row] = await db
    .select()
    .from(orgMemberships)
    .where(
      and(eq(orgMemberships.organizationId, organizationId), eq(orgMemberships.accountId, accountId))
    )
    .limit(1);
  return row;
};

/**
 * Change a member's role.
 *
 * Three refusals, in the order they matter:
 *   1. You cannot grant a role above your own (privilege escalation).
 *   2. An admin cannot touch an owner (§6.2 footnote 1).
 *   3. The last owner cannot be demoted — that would orphan the org (T23).
 */
export async function changeRole(
  db: Database,
  organizationId: string,
  actorRole: OrgRole,
  targetAccountId: string,
  nextRole: OrgRole
): Promise<MemberRow> {
  const target = await findMembership(db, organizationId, targetAccountId);
  if (!target) throw problem.notFound(ProblemCode.NOT_FOUND, 'That member does not exist.');

  const currentRole = normaliseRole(target.role);

  if (RANK[nextRole] > RANK[actorRole]) {
    throw problem.forbidden(
      ProblemCode.INSUFFICIENT_PERMISSION,
      'You cannot grant a role above your own.'
    );
  }

  if (currentRole === 'owner' && actorRole !== 'owner') {
    throw problem.forbidden(ProblemCode.INSUFFICIENT_PERMISSION, 'Only an owner may change an owner.');
  }

  if (currentRole === 'owner' && nextRole !== 'owner' && (await countOwners(db, organizationId)) <= 1) {
    throw problem.conflict(
      ProblemCode.LAST_OWNER,
      'This is the only owner. Promote someone else first.'
    );
  }

  await db
    .update(orgMemberships)
    .set({ role: nextRole, updatedAt: new Date() })
    .where(eq(orgMemberships.id, target.id));

  const [row] = await listMembers(db, organizationId).then((rows) =>
    rows.filter((r) => r.accountId === targetAccountId)
  );
  return row;
}

export async function removeMember(
  db: Database,
  organizationId: string,
  actorRole: OrgRole,
  targetAccountId: string
): Promise<void> {
  const target = await findMembership(db, organizationId, targetAccountId);
  if (!target) throw problem.notFound(ProblemCode.NOT_FOUND, 'That member does not exist.');

  const currentRole = normaliseRole(target.role);

  if (currentRole === 'owner' && actorRole !== 'owner') {
    throw problem.forbidden(ProblemCode.INSUFFICIENT_PERMISSION, 'Only an owner may remove an owner.');
  }

  if (currentRole === 'owner' && (await countOwners(db, organizationId)) <= 1) {
    throw problem.conflict(ProblemCode.LAST_OWNER, 'An organization must keep at least one owner.');
  }

  await db.delete(orgMemberships).where(eq(orgMemberships.id, target.id));
}

// ---------------------------------------------------------------------------
// Invitations (D-B)
// ---------------------------------------------------------------------------

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface CreatedInvitation {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
  /** Returned ONCE, to be emailed. Never stored, never retrievable again. */
  token: string;
}

export async function inviteMember(
  db: Database,
  organizationId: string,
  actorRole: OrgRole,
  actorAccountId: string,
  input: { email: string; role: OrgRole }
): Promise<CreatedInvitation> {
  if (RANK[input.role] > RANK[actorRole]) {
    throw problem.forbidden(
      ProblemCode.INSUFFICIENT_PERMISSION,
      'You cannot invite someone at a role above your own.'
    );
  }

  const email = input.email.trim().toLowerCase();

  // Already a member? Say so plainly rather than issuing a token that will fail.
  const existing = await db
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .innerJoin(accounts, eq(accounts.id, orgMemberships.accountId))
    .where(and(eq(orgMemberships.organizationId, organizationId), sql`lower(${accounts.email}) = ${email}`))
    .limit(1);

  if (existing.length > 0) {
    throw problem.conflict(ProblemCode.ALREADY_MEMBER, 'That person is already a member.');
  }

  // 32 bytes of CSPRNG. Only the hash is persisted, so a database dump does not
  // hand out organisation access.
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(invitations)
    .values({
      organizationId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedByAccountId: actorAccountId,
      expiresAt,
    })
    .returning({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt });

  return { ...row, role: row.role as OrgRole, token };
}

export async function revokeInvitation(
  db: Database,
  organizationId: string,
  invitationId: string
): Promise<void> {
  const result = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.organizationId, organizationId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt)
      )
    )
    .returning({ id: invitations.id });

  if (result.length === 0) {
    throw problem.notFound(ProblemCode.NOT_FOUND, 'No such pending invitation.');
  }
}

/**
 * Accept an invitation.
 *
 * The address on the invitation must match a VERIFIED address on the accepting
 * account (T22). Without that check, anyone holding a leaked link joins as
 * whatever role it names — the token would be a bearer credential for org
 * membership, which is not what an invitation is meant to be.
 */
export async function acceptInvitation(
  db: Database,
  accountId: string,
  verifiedEmails: string[],
  token: string
): Promise<{ organizationId: string; role: OrgRole }> {
  const [invite] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  if (!invite || invite.revokedAt) {
    throw problem.notFound(ProblemCode.NOT_FOUND, 'That invitation is not valid.');
  }
  if (invite.acceptedAt) {
    throw problem.gone(ProblemCode.EXPIRED, 'That invitation has already been accepted.');
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw problem.gone(ProblemCode.EXPIRED, 'That invitation has expired.');
  }

  const invitedTo = invite.email.toLowerCase();
  if (!verifiedEmails.map((e) => e.toLowerCase()).includes(invitedTo)) {
    throw problem.forbidden(
      ProblemCode.INVITATION_MISMATCH,
      'This invitation was issued to a different email address.'
    );
  }

  return db.transaction(async (tx) => {
    const already = await tx
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.organizationId, invite.organizationId),
          eq(orgMemberships.accountId, accountId)
        )
      )
      .limit(1);

    if (already.length === 0) {
      await tx.insert(orgMemberships).values({
        organizationId: invite.organizationId,
        accountId,
        role: invite.role,
        status: 'active',
        provisionedBy: 'manual',
      });
    }

    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));

    return { organizationId: invite.organizationId, role: invite.role as OrgRole };
  });
}

export async function listPendingInvitations(db: Database, organizationId: string) {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt)
      )
    );
}

/** Verified addresses for an account — the gate on accepting an invitation. */
export async function verifiedEmailsFor(db: Database, accountId: string): Promise<string[]> {
  const { identities } = await import('@credopass/lib/schemas/tables');
  const rows = await db
    .select({ email: identities.email })
    .from(identities)
    .where(and(eq(identities.accountId, accountId), eq(identities.emailVerified, true)));
  return rows.map((r) => r.email).filter((e): e is string => Boolean(e));
}
