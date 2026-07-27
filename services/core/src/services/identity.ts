/**
 * IdentityService — turn a verified token into a caller.
 * docs/API-FIRST-REBUILD.md §4.1, D1
 *
 * This is the one service that is PRE-TENANT by definition: it runs before an
 * organisation is known, so it is exempt from the `scoped(db, ctx)` rule.
 *
 * The invariant that matters most, and the one T47 checks by grep:
 *
 *   A caller is identified by (issuer, subject). NEVER by email address.
 *
 * Email is user-editable at many providers, absent for anonymous sessions, and
 * is exactly the stopgap the old routes/org-memberships.ts:97 used. It appears
 * below only as DATA to record, and once as a gate on claiming — never as the
 * key that answers "who is this?".
 *
 * No framework imports (rule 3, enforced by eslint).
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  accounts,
  identities,
  orgMemberships,
  people,
} from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import type { OrgRole } from '../authz/permissions';

export interface Caller {
  accountId: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  memberships: CallerMembership[];
}

export interface CallerMembership {
  organizationId: string;
  role: OrgRole;
  status: string;
}

export interface ResolveInput {
  issuer: string;
  subject: string;
  claims: {
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
    is_anonymous?: unknown;
    [k: string]: unknown;
  };
  providerKind: 'supabase' | 'oidc' | 'saml';
  orgIdentityProviderId?: string | null;
}

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null;

/**
 * Thrown inside the account-creation transaction when another request inserted
 * the same `(issuer, subject)` first. Rolls the transaction back; never escapes
 * `resolveCaller`.
 */
class LostIdentityRace extends Error {
  constructor() {
    super('identity already created by a concurrent request');
    this.name = 'LostIdentityRace';
  }
}

/**
 * A friendly label for an anonymous guest, e.g. `Guest 4821`.
 *
 * Anonymous sign-ins assert no `name` claim, so without this every guest shows
 * up as a raw UUID (or as nothing at all) everywhere a display name is rendered.
 *
 * Derived from the subject rather than randomised, so the same anonymous user
 * keeps the same label if the account is ever recreated, and so tests are
 * deterministic. Four digits is a label, not an identifier — collisions are
 * expected and harmless; `(issuer, subject)` remains the only thing that
 * identifies a caller.
 */
export const guestDisplayName = (subject: string): string => {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash * 31 + subject.charCodeAt(i)) % 10000;
  }
  return `Guest ${String(hash).padStart(4, '0')}`;
};

/**
 * Find the account behind `(issuer, subject)`, creating it on first sight.
 *
 * "Creating on first sight" is not the same as the lazy-guest rule in D16: a
 * token that verifies represents a real authenticated human, and they need an
 * account row to hang memberships on. What D16 forbids is creating an account
 * for someone who has merely *visited* — which never reaches this function,
 * because there is no token.
 */
export async function resolveCaller(db: Database, input: ResolveInput): Promise<Caller> {
  const email = asString(input.claims.email);
  const emailVerified = input.claims.email_verified === true;
  const isGuest = input.claims.is_anonymous === true;

  const existing = await db
    .select({ id: identities.id, accountId: identities.accountId })
    .from(identities)
    .where(and(eq(identities.issuer, input.issuer), eq(identities.subject, input.subject)))
    .limit(1);

  let accountId: string;

  if (existing.length > 0) {
    accountId = existing[0].accountId;

    // Refresh what the provider asserts. This is recording, not identifying.
    await db
      .update(identities)
      .set({ email, emailVerified, lastLoginAt: new Date() })
      .where(eq(identities.id, existing[0].id));
  } else {
    // A new (issuer, subject). Note we do NOT look for an existing account by
    // email and attach to it — that would let anyone who can get a token from
    // any registered issuer for an address take over that account.
    //
    // Concurrency matters here, and used to be got wrong. A brand-new caller's
    // first page load fires several requests at once; every one of them misses
    // the SELECT above, and every one of them tried to insert. The unique index
    // `uq_identities_issuer_subject` then rejected all but one, so a new user's
    // very first requests answered 500 (reproduced: 3 of 4 concurrent).
    //
    // Two things fix it. The insert tolerates the conflict instead of raising,
    // and the pair is one transaction — so a lost race rolls the account back
    // rather than leaving an orphan with no identity pointing at it.
    const created = await db
      .transaction(async (tx) => {
        const [account] = await tx
          .insert(accounts)
          .values({
            email,
            // A guest asserts no name; fall back to a readable label rather
            // than leaving every guest nameless in the UI.
            displayName:
              asString(input.claims.name) ?? (isGuest ? guestDisplayName(input.subject) : null),
            isGuest,
            lastSeenAt: new Date(),
          })
          .returning({ id: accounts.id });

        const inserted = await tx
          .insert(identities)
          .values({
            accountId: account.id,
            issuer: input.issuer,
            subject: input.subject,
            providerKind: input.providerKind,
            orgIdentityProviderId: input.orgIdentityProviderId ?? null,
            email,
            emailVerified,
            lastLoginAt: new Date(),
          })
          .onConflictDoNothing({ target: [identities.issuer, identities.subject] })
          .returning({ id: identities.id });

        // Lost the race: another request inserted this identity first. Abort so
        // the account we just made is rolled back, then read theirs below.
        if (inserted.length === 0) throw new LostIdentityRace();

        return account.id;
      })
      .catch((error: unknown) => {
        if (error instanceof LostIdentityRace) return null;
        throw error;
      });

    if (created) {
      accountId = created;
    } else {
      const [winner] = await db
        .select({ accountId: identities.accountId })
        .from(identities)
        .where(and(eq(identities.issuer, input.issuer), eq(identities.subject, input.subject)))
        .limit(1);

      // The row is guaranteed to exist: the conflict above proves it was
      // committed. Treat its absence as a real fault rather than papering over
      // it with a second account.
      if (!winner) {
        throw new Error('identity conflicted on insert but could not be read back');
      }
      accountId = winner.accountId;
    }
  }

  const [account] = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      displayName: accounts.displayName,
      isGuest: accounts.isGuest,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const memberships = await loadMemberships(db, accountId);

  return {
    accountId,
    email: account?.email ?? null,
    displayName: account?.displayName ?? null,
    isGuest: account?.isGuest ?? false,
    memberships,
  };
}

/**
 * A caller's active memberships. Read on every authenticated request, which is
 * why `org_memberships(account_id)` is indexed.
 */
export async function loadMemberships(
  db: Database,
  accountId: string
): Promise<CallerMembership[]> {
  const rows = await db
    .select({
      organizationId: orgMemberships.organizationId,
      role: orgMemberships.role,
      status: orgMemberships.status,
    })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.accountId, accountId), eq(orgMemberships.status, 'active')));

  // The legacy `role` column is text with the OLD vocabulary. `member` maps to
  // `organizer`; anything unrecognised falls back to the least privilege rather
  // than crashing or, worse, defaulting to something permissive.
  return rows.map((r) => ({
    organizationId: r.organizationId,
    role: normaliseRole(r.role),
    status: r.status,
  }));
}

const ROLE_ALIASES: Record<string, OrgRole> = {
  owner: 'owner',
  admin: 'admin',
  organizer: 'organizer',
  member: 'organizer',
  checkin: 'checkin',
  viewer: 'viewer',
};

export const normaliseRole = (raw: string | null | undefined): OrgRole =>
  ROLE_ALIASES[String(raw ?? '').toLowerCase()] ?? 'viewer';

/**
 * Link prior anonymous registrations to this account (D17, T33/T34).
 *
 * Matches ONLY on an address the provider asserts as verified. An unverified
 * address claims nothing — that would be account takeover by typo. Creates no
 * membership: claiming a ticket is not joining an organisation (T34).
 */
export async function claimByVerifiedEmail(
  db: Database,
  accountId: string
): Promise<{ claimed: number; organizations: number }> {
  const verified = await db
    .select({ email: identities.email })
    .from(identities)
    .where(and(eq(identities.accountId, accountId), eq(identities.emailVerified, true)));

  const addresses = verified
    .map((v) => v.email?.toLowerCase())
    .filter((e): e is string => Boolean(e));

  if (addresses.length === 0) return { claimed: 0, organizations: 0 };

  const claimed = await db
    .update(people)
    .set({ accountId, updatedAt: new Date() })
    .where(
      and(
        isNull(people.accountId),
        isNull(people.deletedAt),
        // `inArray`, not `= ANY(${addresses})`. The raw form bound the JS array
        // as a single parameter, so Postgres read the address as an array
        // literal and raised `malformed array literal` — a guaranteed 500 on
        // every claim. `inArray` expands to a proper parameter list.
        inArray(sql`lower(${people.email})`, addresses)
      )
    )
    .returning({ organizationId: people.organizationId });

  return {
    claimed: claimed.length,
    organizations: new Set(claimed.map((c) => c.organizationId)).size,
  };
}
