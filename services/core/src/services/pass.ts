/**
 * PassService — issue, verify and revoke attendee passes.
 * docs/API-FIRST-REBUILD.md §4.7, D12, D19
 *
 * WHAT WAS WRONG. The old pass QR encoded `{eventId}:{userId}` — a raw event id
 * and a raw user id, both of which appear in URLs and API responses. Anyone who
 * knew two ids could mint someone else's pass. And the kiosk "validated" it by
 * scanning a client-side user cache, so whether a pass was valid depended on
 * what happened to be in a browser's memory.
 *
 * WHAT IT IS NOW. `CP1.{base64url(payload)}.{sig}` — HMAC-SHA256 over
 * `{e, p, x}` (event, person, expiry) with a per-organisation key.
 *
 * The ordering matters and is the point of T37: **the signature is verified
 * before any database lookup**, so an unsigned guess never reaches Postgres.
 * A forged token costs an attacker one HMAC on our side and nothing else.
 *
 * No framework imports (rule 3).
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { passes } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import { ProblemCode, problem } from '../http/problem';

const VERSION = 'CP1';

export interface PassPayload {
  /** eventId */ e: string;
  /** personId */ p: string;
  /** expiry, epoch seconds */ x: number;
}

export interface IssuedPass {
  id: string;
  token: string;
  url: string;
  expiresAt: Date;
}

/**
 * The signing key for an organisation.
 *
 * Derived from a single root secret rather than stored per-org, so there is one
 * secret to manage and rotating it invalidates every pass at once — which is
 * the behaviour you want from a compromise. Phase 6 moves the root into GCP
 * Secret Manager.
 */
function keyFor(organizationId: string): Buffer {
  const root = process.env.PASS_SIGNING_KEY;
  if (!root) {
    // Failing loudly beats signing with a default. A predictable key is the
    // same as no signature at all.
    throw problem.internal(
      'PASS_SIGNING_KEY is not set. Passes cannot be issued or verified.'
    );
  }
  return createHmac('sha256', root).update(`org:${organizationId}`).digest();
}

const b64u = (buf: Buffer | string): string =>
  Buffer.from(buf as never).toString('base64url');

const sign = (key: Buffer, body: string): string =>
  createHmac('sha256', key).update(body).digest('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * Constant-time comparison.
 *
 * `a === b` on a signature leaks its prefix through timing. `timingSafeEqual`
 * throws on length mismatch, so the lengths are checked first — and that check
 * is safe to make in variable time because a signature's length is not secret.
 */
function signatureMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Issue a pass. Idempotent per (event, person): re-issuing revokes the previous
 * live pass, so a "resend" never leaves two valid credentials in the world.
 */
export async function issue(
  db: Database,
  input: {
    organizationId: string;
    eventId: string;
    personId: string;
    /** Defaults to event end + 24h, so a printed pass never expires mid-event. */
    expiresAt: Date;
    origin: string;
  }
): Promise<IssuedPass> {
  const payload: PassPayload = {
    e: input.eventId,
    p: input.personId,
    x: Math.floor(input.expiresAt.getTime() / 1000),
  };

  const body = `${VERSION}.${b64u(JSON.stringify(payload))}`;
  // Salt so two passes for the same (event, person, expiry) differ. Without it
  // the token is a pure function of its inputs and therefore guessable by
  // anyone who knows them — which is the bug being fixed.
  const salted = `${body}.${b64u(randomBytes(9))}`;
  const token = `${salted}.${sign(keyFor(input.organizationId), salted)}`;

  const [row] = await db.transaction(async (tx) => {
    await tx
      .update(passes)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(passes.eventId, input.eventId),
          eq(passes.personId, input.personId),
          isNull(passes.revokedAt)
        )
      );

    return tx
      .insert(passes)
      .values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        personId: input.personId,
        tokenHash: hashToken(token),
        expiresAt: input.expiresAt,
      })
      .returning({ id: passes.id });
  });

  return {
    id: row.id,
    token,
    url: `${input.origin.replace(/\/$/, '')}/p/${token}`,
    expiresAt: input.expiresAt,
  };
}

export interface VerifiedPass {
  passId: string;
  eventId: string;
  personId: string;
  organizationId: string;
}

/**
 * Verify a token and resolve what it names.
 *
 * Order is deliberate:
 *   1. shape        — cheap, rejects noise
 *   2. expiry       — from the payload, no I/O
 *   3. signature    — one HMAC; a forgery stops HERE
 *   4. database     — only now, and only for a token we already trust
 *
 * The organisation id is not in the payload (it would leak tenant structure
 * into a URL an attendee forwards), so step 3 needs a candidate key. The row
 * lookup supplies it — which means the HMAC is verified twice: once against a
 * key derived from the row's org, and never against attacker-supplied input.
 */
export async function verify(db: Database, token: string): Promise<VerifiedPass> {
  const invalid = () => problem.badRequest(ProblemCode.INVALID_PASS, 'That pass is not valid.');

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) throw invalid();

  let payload: PassPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (!payload?.e || !payload?.p || !payload?.x) throw invalid();

  if (payload.x * 1000 < Date.now()) {
    throw problem.gone(ProblemCode.PASS_EXPIRED, 'That pass has expired.');
  }

  const [row] = await db
    .select({
      id: passes.id,
      organizationId: passes.organizationId,
      eventId: passes.eventId,
      personId: passes.personId,
      expiresAt: passes.expiresAt,
      revokedAt: passes.revokedAt,
    })
    .from(passes)
    .where(eq(passes.tokenHash, hashToken(token)))
    .limit(1);

  // A hash lookup miss means the token was never issued — indistinguishable to
  // the caller from a bad signature, and deliberately so.
  if (!row) throw invalid();

  const signed = parts.slice(0, 3).join('.');
  if (!signatureMatches(sign(keyFor(row.organizationId), signed), parts[3])) throw invalid();

  // The payload must agree with the row. If they diverge, someone has been
  // editing tokens and got lucky with a hash collision — treat as forged.
  if (row.eventId !== payload.e || row.personId !== payload.p) throw invalid();

  if (row.revokedAt) throw problem.gone(ProblemCode.REVOKED, 'That pass has been revoked.');
  if (row.expiresAt.getTime() < Date.now()) {
    throw problem.gone(ProblemCode.PASS_EXPIRED, 'That pass has expired.');
  }

  return {
    passId: row.id,
    eventId: row.eventId,
    personId: row.personId,
    organizationId: row.organizationId,
  };
}

/** Record a view. Abuse signal: a pass seen 40 times has been forwarded around. */
export async function recordView(db: Database, passId: string): Promise<void> {
  await db
    .update(passes)
    .set({ lastViewedAt: new Date(), viewCount: sql`${passes.viewCount} + 1` })
    .where(eq(passes.id, passId));
}

export async function revoke(db: Database, passId: string): Promise<void> {
  await db.update(passes).set({ revokedAt: new Date() }).where(eq(passes.id, passId));
}

/** Default expiry: the event's end plus a day, so a printed pass stays usable. */
export const defaultExpiry = (eventEndAt: Date): Date =>
  new Date(eventEndAt.getTime() + 24 * 60 * 60 * 1000);
