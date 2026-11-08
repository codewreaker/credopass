/**
 * `emailVerifiedFromClaims` — the gate on claiming prior registrations (D17).
 *
 * This matters more than its size suggests. `identities.email_verified` is the
 * ONLY thing standing between "link the guest registrations for this address
 * to this account" and account takeover by typing someone else's email at a
 * provider that does not check. It was also, until this function existed,
 * permanently `false` for every account in the product: the code read
 * `claims.email_verified`, Supabase sends no such top-level claim, and so
 * `claimByVerifiedEmail` could never match a row and "My passes" would have
 * shipped empty for everyone who registered before signing in.
 *
 * The two properties under test are therefore opposite in kind:
 *
 *   · It must FIRE for a real Google session, or the feature does not work.
 *   · It must NOT fire for anything the account holder can write, or the
 *     feature is a vulnerability. `user_metadata` is writable with one
 *     `auth.updateUser({ data })` call, which is why it is named here.
 */

import { describe, expect, it } from 'bun:test';
import { emailVerifiedFromClaims } from '../services/identity';

describe('emailVerifiedFromClaims', () => {
  it('honours a signed top-level email_verified claim', () => {
    expect(emailVerifiedFromClaims({ email: 'a@b.com', email_verified: true })).toBe(true);
  });

  it('accepts a Supabase Google session, which sends no such claim', () => {
    expect(
      emailVerifiedFromClaims({
        email: 'israel@example.com',
        app_metadata: { provider: 'google', providers: ['google'] },
      })
    ).toBe(true);
  });

  it('reads the provider out of amr when app_metadata is absent', () => {
    expect(
      emailVerifiedFromClaims({
        email: 'israel@example.com',
        amr: [{ method: 'oauth', provider: 'google', timestamp: 1 }],
      })
    ).toBe(true);
  });

  it('NEVER trusts user_metadata, which the account holder can write', () => {
    expect(
      emailVerifiedFromClaims({
        email: 'victim@example.com',
        user_metadata: { email_verified: true, provider: 'google' },
      })
    ).toBe(false);
  });

  it('refuses an email+password session, where the address is unconfirmed', () => {
    expect(
      emailVerifiedFromClaims({
        email: 'victim@example.com',
        app_metadata: { provider: 'email', providers: ['email'] },
      })
    ).toBe(false);
  });

  it('refuses a federated session carrying no address at all', () => {
    expect(emailVerifiedFromClaims({ app_metadata: { provider: 'google' } })).toBe(false);
  });

  it('refuses a session with no provider evidence of any kind', () => {
    expect(emailVerifiedFromClaims({ email: 'a@b.com' })).toBe(false);
  });
});
