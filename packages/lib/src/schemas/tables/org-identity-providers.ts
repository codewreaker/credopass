// ============================================================================
// FILE: packages/lib/src/schemas/tables/org-identity-providers.ts
// Per-tenant SSO config + verified domains for home-realm discovery.
// docs/API-FIRST-REBUILD.md §3.2, D1
// ============================================================================

import { pgTable, text, timestamp, index, uuid, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { identityProviderKind, orgRole } from './enums';

/**
 * The schema lands in Phase 1; the OIDC/SAML FLOWS land in Phase 7.
 *
 * Doing it in this order costs two tables now and makes Phase 7 additive rather
 * than a re-model. Retrofitting identity later is the most expensive refactor
 * there is, and an enterprise tenant asking for SSO is not a reason to redesign
 * the authorization model.
 *
 * Adding a tenant's Okta is a row here — not a deploy.
 */
export const orgIdentityProviders = pgTable('org_identity_providers', {
  id: uuid('id').primaryKey().defaultRandom(),

  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  kind: identityProviderKind('kind').notNull(),
  displayName: text('display_name').notNull(),

  // Must match the token's `iss` exactly. Globally unique: an issuer belongs to
  // one organisation, or nobody could tell whose token it is.
  issuer: text('issuer').notNull().unique(),

  jwksUri: text('jwks_uri'),
  metadataUrl: text('metadata_url'),

  // Rejected if the token's `aud` differs.
  audience: text('audience').notNull(),

  // JIT provisioning lands here and NEVER above it, whatever the IdP asserts
  // in its claims (T46). Deliberately the least privilege.
  defaultRole: orgRole('default_role').notNull().default('viewer'),

  jitProvisioning: boolean('jit_provisioning').notNull().default(true),
  // Refuse password/social sign-in for this org's VERIFIED domains.
  enforceSso: boolean('enforce_sso').notNull().default(false),
  enabled: boolean('enabled').notNull().default(false),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_org_idp_organization_id').on(table.organizationId),
  index('idx_org_idp_issuer').on(table.issuer),
]).enableRLS();

/**
 * Verified email domains → home-realm discovery.
 *
 * Verification is MANDATORY, not a nicety. Without it, anyone signs up, claims
 * `gmail.com`, enables `enforce_sso`, and now controls the sign-in path for
 * every Gmail address (T41). Public-suffix domains are additionally blocklisted
 * regardless of DNS proof (T42) — that check lives in IdentityService.
 */
export const orgDomains = pgTable('org_domains', {
  id: uuid('id').primaryKey().defaultRandom(),

  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  domain: text('domain').notNull(),

  // The DNS TXT value the org must publish to prove ownership.
  verificationToken: text('verification_token').notNull(),

  // NULL ⇒ the domain does nothing at all. This is the whole safety property.
  verifiedAt: timestamp('verified_at', { mode: 'date', withTimezone: true }),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // A VERIFIED domain belongs to exactly one org. Unverified duplicates are
  // allowed — two orgs may both be mid-verification for the same domain, and
  // only the one that publishes the TXT record wins.
  uniqueIndex('uq_org_domains_verified')
    .on(sql`lower(${table.domain})`)
    .where(sql`${table.verifiedAt} IS NOT NULL`),

  index('idx_org_domains_organization_id').on(table.organizationId),
  index('idx_org_domains_lookup').on(sql`lower(${table.domain})`),
]).enableRLS();

export type OrgIdentityProviderTable = typeof orgIdentityProviders;
export type OrgDomainTable = typeof orgDomains;
