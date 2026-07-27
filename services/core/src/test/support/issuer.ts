/**
 * A trusted issuer that lives inside the test process.
 *
 * The adversarial suite's whole subject is "who is this caller, and what may
 * they see" — so it has to send tokens the real middleware really verifies.
 * Faking `requireCaller` would delete the thing under test.
 *
 * `IssuerRegistry.verify` normally fetches a remote JWKS, which a test must not
 * depend on. So this subclass keeps the registry's contract — an `iss` it does
 * not recognise is still rejected, a bad signature is still rejected — and only
 * swaps *where the key comes from*: a keypair generated in-process rather than
 * over HTTP. Everything the suite asserts about trust (T43, T44) therefore
 * still runs against real signature verification.
 *
 * Installed through `setIssuerRegistry`, the seam `middleware/caller.ts`
 * already exposes for exactly this.
 */

import { SignJWT, jwtVerify, generateKeyPair, type JWTPayload, type CryptoKey } from 'jose';
import { IssuerRegistry, type TrustedIssuer, type VerifiedToken } from '../../identity/issuer-registry';
import { setIssuerRegistry } from '../../middleware/caller';

/** The platform issuer — stands in for the Supabase project. */
export const TEST_ISSUER = 'https://test.supabase.local/auth/v1';
export const TEST_AUDIENCE = 'authenticated';

/** A second issuer, used to prove a token from org B's IdP cannot reach A (T44). */
export const FOREIGN_ISSUER = 'https://idp.acme.test/oidc';

interface Keys {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

const keysFor = new Map<string, Keys>();

async function keys(issuer: string): Promise<Keys> {
  const existing = keysFor.get(issuer);
  if (existing) return existing;
  // `extractable` is irrelevant here; the key never leaves the process.
  const pair = (await generateKeyPair('ES256')) as Keys;
  keysFor.set(issuer, pair);
  return pair;
}

class InProcessIssuerRegistry extends IssuerRegistry {
  /**
   * Same shape as the real one: select the key set by the UNVERIFIED `iss`,
   * then verify the signature against it. A forged `iss` picks a key set whose
   * keys do not validate, exactly as in production.
   */
  override async verify(token: string): Promise<VerifiedToken | null> {
    const iss = readIssuer(token);
    if (!iss) return null;

    const trusted = this.get(iss);
    if (!trusted) return null;

    const pair = keysFor.get(iss);
    if (!pair) return null;

    try {
      const { payload } = await jwtVerify(token, pair.publicKey, {
        issuer: trusted.issuer,
        ...(trusted.audience ? { audience: trusted.audience } : {}),
        algorithms: trusted.algorithms,
      });

      const subject = payload[trusted.subjectClaim];
      if (typeof subject !== 'string' || subject.length === 0) return null;

      return { issuer: trusted.issuer, subject, claims: payload, trusted };
    } catch {
      return null;
    }
  }
}

function readIssuer(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.iss === 'string' ? payload.iss : null;
  } catch {
    return null;
  }
}

let installed: InProcessIssuerRegistry | null = null;

/**
 * Register the in-process issuers and install them globally.
 *
 * `organizationId` on the foreign issuer is left null until a test needs a
 * per-org IdP; T44's point is that the *issuer* does not carry authority to
 * reach an organisation, so the membership check is what must reject it.
 */
export async function installTestIssuers(): Promise<void> {
  if (installed) return;

  const registry = new InProcessIssuerRegistry();

  for (const issuer of [TEST_ISSUER, FOREIGN_ISSUER]) {
    await keys(issuer);
  }

  registry.register({
    issuer: TEST_ISSUER,
    jwksUri: `${TEST_ISSUER}/.well-known/jwks.json`,
    algorithms: ['ES256'],
    audience: TEST_AUDIENCE,
    organizationId: null,
    providerKind: 'supabase',
    subjectClaim: 'sub',
  } satisfies TrustedIssuer);

  registry.register({
    issuer: FOREIGN_ISSUER,
    jwksUri: `${FOREIGN_ISSUER}/.well-known/jwks.json`,
    algorithms: ['ES256'],
    organizationId: null,
    providerKind: 'oidc',
    subjectClaim: 'sub',
  } satisfies TrustedIssuer);

  setIssuerRegistry(registry);
  installed = registry;
}

export function uninstallTestIssuers(): void {
  setIssuerRegistry(null);
  installed = null;
}

export interface MintOptions {
  subject?: string;
  issuer?: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  isAnonymous?: boolean;
  /** Seconds from now. Negative mints an already-expired token. */
  expiresIn?: number;
  extraClaims?: JWTPayload;
}

/** Sign a token this process will accept. */
export async function mintToken(opts: MintOptions = {}): Promise<string> {
  const issuer = opts.issuer ?? TEST_ISSUER;
  const pair = await keys(issuer);
  const now = Math.floor(Date.now() / 1000);

  const claims: JWTPayload = {
    ...(opts.email ? { email: opts.email } : {}),
    ...(opts.emailVerified !== undefined ? { email_verified: opts.emailVerified } : {}),
    ...(opts.name ? { name: opts.name } : {}),
    ...(opts.isAnonymous ? { is_anonymous: true } : {}),
    ...opts.extraClaims,
  };

  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(issuer)
    .setSubject(opts.subject ?? `sub-${crypto.randomUUID()}`)
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.expiresIn ?? 3600));

  // The foreign issuer is registered without an audience, so setting one would
  // be verified against nothing — keep the token honest about that.
  if (issuer === TEST_ISSUER) jwt.setAudience(TEST_AUDIENCE);

  return jwt.sign(pair.privateKey);
}

/** A token signed by a key no registered issuer publishes (T43). */
export async function mintUntrustedToken(): Promise<string> {
  const { privateKey } = (await generateKeyPair('ES256')) as Keys;
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer('https://evil.test/auth/v1')
    .setSubject(`sub-${crypto.randomUUID()}`)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}
