/**
 * The trust anchor is the ISSUER, not a vendor. docs/API-FIRST-REBUILD.md D1.
 *
 * A token is trusted because its `iss` is registered here and its signature
 * verifies against that issuer's JWKS — never because it came from a particular
 * SDK. Two consequences worth stating:
 *
 *   · Adding a tenant's Okta is a config row, not a deploy.
 *   · Replacing Supabase costs one entry here plus a backfill of `identities`,
 *     rather than a rewrite.
 *
 * Supabase is the only entry until a customer asks for SSO. The per-org entries
 * are loaded from `org_identity_providers` (Phase 7 activates the flows; the
 * lookup path is built now so that is additive).
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface TrustedIssuer {
  /** The `iss` claim, matched exactly. Never normalised, never fuzzy. */
  issuer: string;
  jwksUri: string;
  algorithms: string[];
  /** Rejected if the token's `aud` differs. */
  audience?: string;
  /** null = platform-wide (self-serve Supabase). Set = a tenant's own IdP. */
  organizationId: string | null;
  providerKind: 'supabase' | 'oidc' | 'saml';
  /** Which claim carries the stable subject. `sub` everywhere so far. */
  subjectClaim: string;
}

export interface VerifiedToken {
  issuer: string;
  subject: string;
  claims: JWTPayload;
  trusted: TrustedIssuer;
}

export class IssuerRegistry {
  private readonly issuers = new Map<string, TrustedIssuer>();
  private readonly jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  register(issuer: TrustedIssuer): void {
    this.issuers.set(issuer.issuer, issuer);
  }

  get(iss: string): TrustedIssuer | undefined {
    return this.issuers.get(iss);
  }

  list(): TrustedIssuer[] {
    return [...this.issuers.values()];
  }

  /**
   * Verify a bearer token and return `(iss, sub)`.
   *
   * Reads `iss` from the UNVERIFIED payload only to select which key set to
   * check against — the signature is then verified against that issuer's JWKS,
   * so a forged `iss` selects a key set whose keys will not validate the
   * signature. An unregistered issuer is rejected outright (T43).
   */
  async verify(token: string): Promise<VerifiedToken | null> {
    const iss = readIssuerClaim(token);
    if (!iss) return null;

    const trusted = this.issuers.get(iss);
    if (!trusted) return null;

    let keys = this.jwks.get(iss);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(trusted.jwksUri));
      this.jwks.set(iss, keys);
    }

    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: trusted.issuer,
        ...(trusted.audience ? { audience: trusted.audience } : {}),
        algorithms: trusted.algorithms,
      });

      const subject = payload[trusted.subjectClaim];
      if (typeof subject !== 'string' || subject.length === 0) return null;

      return { issuer: trusted.issuer, subject, claims: payload, trusted };
    } catch {
      // Expired, wrong audience, bad signature — all the same answer to a
      // caller. Distinguishing them tells an attacker which part to fix.
      return null;
    }
  }
}

/** Decode the `iss` claim without verifying. Used ONLY to pick a key set. */
function readIssuerClaim(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.iss === 'string' ? payload.iss : null;
  } catch {
    return null;
  }
}

/**
 * Build the registry from the environment. Supabase only, by design — see D1.
 */
export function createIssuerRegistry(): IssuerRegistry {
  const registry = new IssuerRegistry();
  const supabaseUrl = process.env.SUPABASE_URL;

  if (supabaseUrl) {
    const base = supabaseUrl.replace(/\/$/, '');
    registry.register({
      issuer: `${base}/auth/v1`,
      jwksUri: `${base}/auth/v1/.well-known/jwks.json`,
      algorithms: ['ES256', 'RS256'],
      audience: 'authenticated',
      organizationId: null,
      providerKind: 'supabase',
      subjectClaim: 'sub',
    });
  }

  return registry;
}
