// ============================================================================
// FILE: packages/lib/src/schemas/tables/identities.ts
// (issuer, subject) → account. The ONLY join to any identity provider.
// docs/API-FIRST-REBUILD.md §3.2, D1
// ============================================================================

import { pgTable, text, timestamp, index, uuid, boolean, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts';

/**
 * The trust anchor is the ISSUER, not a provider name.
 *
 * Keying on `iss` (the exact string in the token) rather than "okta" or
 * "supabase" is what lets two different tenants both run Okta without
 * colliding, and what makes replacing Supabase a row in an issuer table plus a
 * backfill here — rather than a rewrite.
 *
 * Resolution is always: verify the signature against the issuer's JWKS → read
 * `(iss, sub)` → look up this table → get `account_id`.
 *
 * **`email` in this table is never used to identify a caller.** It is recorded
 * as asserted by the provider, and used for exactly one thing: `email_verified`
 * gates claiming prior anonymous registrations (D17). Identifying a caller by
 * email is the bug T47 exists to prevent — email is user-editable at many
 * providers and absent for anonymous sessions.
 */
export const identities = pgTable('identities', {
  id: uuid('id').primaryKey().defaultRandom(),

  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  // The `iss` claim, verbatim. Exact match, never normalised.
  issuer: text('issuer').notNull(),
  // The `sub` claim — Supabase's auth.uid(), Okta's sub, and so on.
  subject: text('subject').notNull(),

  // Selects the verifier. Not the trust anchor — `issuer` is.
  providerKind: text('provider_kind', {
    enum: ['supabase', 'oidc', 'saml'],
  }).notNull(),

  // Set when this identity came from a tenant's own IdP rather than the
  // platform-wide issuer.
  orgIdentityProviderId: uuid('org_identity_provider_id'),

  email: text('email'),
  // Gates claiming (D17). An unverified address claims nothing — otherwise
  // account takeover is a typo away.
  emailVerified: boolean('email_verified').notNull().default(false),

  lastLoginAt: timestamp('last_login_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // One (issuer, subject) maps to exactly one account. Asserted by T47b.
  unique('uq_identities_issuer_subject').on(table.issuer, table.subject),
  index('idx_identities_account_id').on(table.accountId),
  // The claim path: find verified identities by address (D17).
  index('idx_identities_verified_email').on(sql`lower(${table.email})`).where(sql`${table.emailVerified}`),
]).enableRLS();

export type IdentityTable = typeof identities;
