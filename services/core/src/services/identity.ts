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
 * Email is user-editable at many providers, absent from some federated
 * assertions, and is exactly the stopgap the old
 * routes/org-memberships.ts:97 used. It appears
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
  organizations,
  people,
} from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import type { OrgRole } from '../authz/permissions';

export interface Caller {
  accountId: string;
  email: string | null;
  displayName: string | null;
  memberships: CallerMembership[];
}

export interface CallerMembership {
  organizationId: string;
  /**
   * The organisation's name, carried here so `/me/context` can ship it.
   *
   * Without it the client had to fetch `/organizations` a second time just to
   * label the active org, and the composer rendered "No organization" for the
   * length of that race (B2). The join onto `organizations` below was already
   * happening for the soft-delete filter, so this costs one more column.
   */
  organizationName: string;
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
    given_name?: unknown;
    family_name?: unknown;
    /** Supabase puts the provider's profile claims here. Display only. */
    user_metadata?: unknown;
    [k: string]: unknown;
  };
  providerKind: 'supabase' | 'oidc' | 'saml';
  orgIdentityProviderId?: string | null;
}

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

/**
 * The caller's display name, from wherever the provider actually put it.
 *
 * This used to read `claims.name` alone, which is why every account created
 * before 2026-11-07 has `display_name = NULL` and the console greeted people
 * by their email local part. **Supabase sends no top-level `name` claim** —
 * Google's profile claims land inside `user_metadata`, as `full_name` and
 * `name`, exactly like the `email_verified` case already documented in
 * CLAUDE.md.
 *
 * `user_metadata` is writable by the user (`auth.updateUser({ data })`), so
 * this must stay the ONLY thing read from it: a display name is cosmetic and
 * costs nothing if someone lies about it. An identity decision is not, and
 * must never come from here — see the `emailVerified` handling below, which
 * deliberately reads the top-level claim and nothing else.
 *
 * `given_name` is preferred when present because it is the one the greeting
 * wants; it is frequently absent, which is why the full name is kept as the
 * stored value and the first name is derived by splitting it.
 */
export const displayNameFromClaims = (claims: ResolveInput['claims']): string | null => {
  const metadata =
    typeof claims.user_metadata === 'object' && claims.user_metadata !== null
      ? (claims.user_metadata as Record<string, unknown>)
      : {};

  return (
    asString(metadata.full_name) ??
    asString(metadata.name) ??
    asString(claims.name) ??
    // Last resort: assemble it. Some OIDC providers send the parts and not the
    // whole, and half a name beats an email address.
    asString(
      [asString(metadata.given_name) ?? asString(claims.given_name),
       asString(metadata.family_name) ?? asString(claims.family_name)]
        .filter(Boolean)
        .join(' ')
    )
  );
};

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

const UNIQUE_VIOLATION = '23505';

/**
 * Did this fail because `uq_accounts_email` rejected the row?
 *
 * Drizzle wraps the driver error in a `DrizzleQueryError`, so the pg error —
 * the only thing carrying `code` and `constraint` — is one level down in
 * `cause`. Postgres reports the INDEX name in `constraint` for a unique-index
 * violation, which is why the literal below is the index name.
 */
const isAccountEmailConflict = (error: unknown): boolean => {
  const driver = ((error as { cause?: unknown })?.cause ?? error) as {
    code?: string;
    constraint?: string;
  };
  return driver?.code === UNIQUE_VIOLATION && driver?.constraint === 'uq_accounts_email';
};

/** Is this address free to mirror onto a NEW account row? */
async function emailIsUnclaimed(db: Database, email: string | null): Promise<boolean> {
  if (!email) return false;
  const [taken] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(sql`lower(${accounts.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return !taken;
}

/**
 * Find the account behind `(issuer, subject)`, creating it on first sight.
 *
 * A token that verifies represents a real authenticated human, and they need an
 * account row to hang memberships on. There is no lazier tier below this one:
 * anonymous sign-in is gone and nothing issues a token for someone who has
 * merely visited, so every account this creates belongs to somebody real (D20).
 */
export async function resolveCaller(db: Database, input: ResolveInput): Promise<Caller> {
  const email = asString(input.claims.email);
  const emailVerified = input.claims.email_verified === true;
  const displayName = displayNameFromClaims(input.claims);

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

    // Backfill the account's display name, but only when we have none.
    //
    // Without this, the name is written at account CREATION and never again —
    // so every account that existed before the claim-reading fix above would
    // keep its NULL forever and keep being greeted by its email local part.
    //
    // **Fill, never overwrite.** `PATCH /me` lets someone set their own name
    // (U4), and following the provider on every sign-in would silently undo
    // that the next time they signed in. A token that omits the claim must not
    // wipe the row either. So: NULL gets filled, anything else is left alone,
    // and the user's own edit always wins over what Google asserts.
    if (displayName) {
      await db
        .update(accounts)
        .set({ displayName })
        .where(and(eq(accounts.id, accountId), isNull(accounts.displayName)));
    }
  } else {
    // A new (issuer, subject).
    //
    // `accounts.email` is a MIRROR of what the provider asserted, not a key.
    // `uq_accounts_email` exists so one address is not spread over several
    // account rows — it is NOT an identity, and it must never be treated as
    // one: attaching to the account that already holds the address would let
    // anyone who can get a token for it from any registered issuer take that
    // account over.
    //
    // So when the address is already claimed, the new account takes none and
    // the address lives on the identity row, which has no such index. This is
    // the ordinary case of one human with two provider identities — a password
    // sign-up and the GitHub button, or a Supabase user that was recreated —
    // and before this it was a 500 on EVERY authenticated request they made,
    // because the account insert below raised and nothing caught it.
    const accountEmail = (await emailIsUnclaimed(db, email)) ? email : null;

    // Concurrency matters here, and used to be got wrong. A brand-new caller's
    // first page load fires several requests at once; every one of them misses
    // the SELECT above, and every one of them tried to insert. The unique index
    // `uq_identities_issuer_subject` then rejected all but one, so a new user's
    // very first requests answered 500 (reproduced: 3 of 4 concurrent).
    //
    // Two things fix it. The insert tolerates the conflict instead of raising,
    // and the pair is one transaction — so a lost race rolls the account back
    // rather than leaving an orphan with no identity pointing at it.
    const createAccount = (mirroredEmail: string | null) =>
      db.transaction(async (tx) => {
        const [account] = await tx
          .insert(accounts)
          .values({
            email: mirroredEmail,
            displayName,
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
            // The address is recorded HERE regardless of whether the account
            // row could mirror it, so nothing the provider asserted is lost.
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
      });

    const lostRace = (error: unknown): null => {
      if (error instanceof LostIdentityRace) return null;
      throw error;
    };

    const created = await createAccount(accountEmail).catch((error: unknown) => {
      // Another sign-in claimed the address between the check and the insert.
      // Rare, and the answer is the same as the checked case: keep the address
      // on the identity only.
      if (isAccountEmailConflict(error)) return createAccount(null).catch(lostRace);
      return lostRace(error);
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
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const memberships = await loadMemberships(db, accountId);

  return {
    accountId,
    // The account row may carry no address — another account already holds it
    // (see the mirror note above) — so fall back to what this token asserted.
    // Display data either way; nothing identifies a caller by it.
    email: account?.email ?? email,
    displayName: account?.displayName ?? null,
    memberships,
  };
}

/**
 * A caller's active memberships. Read on every authenticated request, which is
 * why `org_memberships(account_id)` is indexed.
 *
 * The join onto `organizations` is not decoration. Deleting an organisation is a
 * SOFT delete, and the membership rows survive it — so without the
 * `deleted_at IS NULL` filter a deleted organisation stayed a perfectly valid
 * tenant: `requireTenant` still resolved it (sole membership ⇒ no header
 * needed), and `POST /events` happily wrote events into an organisation the
 * owner had deleted and could no longer see, because `/organizations` and
 * `/me/context` both filter it out. That was one bug reported as two.
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
      organizationName: organizations.name,
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

  // `role` is a pg enum (`org_role`), so the database cannot hand back anything
  // outside the vocabulary. This stays as a total function anyway: an unreadable
  // role falls back to the LEAST privilege rather than crashing or, worse,
  // defaulting to something permissive.
  return rows.map((r) => ({
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    role: normaliseRole(r.role),
    status: r.status,
  }));
}

const ROLE_ALIASES: Record<string, OrgRole> = {
  owner: 'owner',
  admin: 'admin',
  organizer: 'organizer',
  checkin: 'checkin',
  viewer: 'viewer',
};

export const normaliseRole = (raw: string | null | undefined): OrgRole =>
  ROLE_ALIASES[String(raw ?? '').toLowerCase()] ?? 'viewer';

/**
 * Link prior unclaimed registrations to this account (D17, T33/T34).
 *
 * Written, tested by nobody, and deliberately unrouted: `/me/claim` is deferred
 * with the rest of the "My Tickets" surface (D26). Kept because the moment that
 * screen lands, this is the query it needs.
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

/**
 * Set (or clear) an account's display name. Backs `PATCH /me` (U4).
 *
 * Pre-tenant by nature, like everything else in this file: an account is not
 * scoped to an organisation, and `accountId` comes from a verified token, never
 * from the request body.
 *
 * Only the name. `accounts.email` is a mirror of a provider assertion and is
 * not user-editable — see the route for why.
 */
export async function updateAccountDisplayName(
  db: Database,
  accountId: string,
  displayName: string | null
): Promise<{ id: string; email: string | null; displayName: string | null }> {
  const [row] = await db
    .update(accounts)
    .set({ displayName: displayName === null ? null : displayName.trim() })
    .where(eq(accounts.id, accountId))
    .returning({
      id: accounts.id,
      email: accounts.email,
      displayName: accounts.displayName,
    });

  // The row is the caller's own and the token verified, so its absence is a
  // real fault — an account deleted mid-request — not a 404 to hand back.
  if (!row) throw new Error(`account ${accountId} vanished during update`);

  return row;
}
