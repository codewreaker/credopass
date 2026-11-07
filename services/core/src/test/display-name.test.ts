/**
 * Where a display name actually comes from.
 *
 * This existed as one expression — `asString(claims.name)` — and it was wrong
 * for the only identity provider the product has. **Supabase sends no
 * top-level `name` claim**: Google's profile claims arrive inside
 * `user_metadata`. So `accounts.display_name` was NULL for every account ever
 * created, and the console greeted everyone by their email local part (F1).
 *
 * The table below is the contract. The last two cases are the ones that
 * matter: a real Supabase/Google token, and a token with nothing in it.
 */

import { describe, expect, it } from 'bun:test';
import { displayNameFromClaims } from '../services/identity';

describe('displayNameFromClaims', () => {
  it('reads user_metadata.full_name — what Supabase + Google actually send', () => {
    expect(
      displayNameFromClaims({
        email: 'developer.prempeh@gmail.com',
        user_metadata: {
          full_name: 'Israel Agyeman-Prempeh',
          name: 'Israel Agyeman-Prempeh',
          avatar_url: 'https://example.com/a.png',
        },
      })
    ).toBe('Israel Agyeman-Prempeh');
  });

  it('falls back to user_metadata.name when full_name is absent', () => {
    expect(displayNameFromClaims({ user_metadata: { name: 'Ama Mensah' } })).toBe('Ama Mensah');
  });

  it('still honours a top-level name claim, for a plain OIDC issuer', () => {
    expect(displayNameFromClaims({ name: 'Kwame Boateng' })).toBe('Kwame Boateng');
  });

  it('prefers user_metadata over a top-level claim', () => {
    expect(
      displayNameFromClaims({ name: 'stale', user_metadata: { full_name: 'current' } })
    ).toBe('current');
  });

  it('assembles given_name + family_name when no whole name is sent', () => {
    expect(displayNameFromClaims({ given_name: 'Ama', family_name: 'Mensah' })).toBe('Ama Mensah');
  });

  it('takes a lone given_name rather than nothing', () => {
    expect(displayNameFromClaims({ given_name: 'Ama' })).toBe('Ama');
  });

  it('is null when the token asserts no name at all', () => {
    // The caller then falls back to the email local part, which is the
    // behaviour everybody saw before this was fixed — now the exception.
    expect(displayNameFromClaims({ email: 'someone@example.com' })).toBeNull();
  });

  it('treats blank and whitespace-only names as absent', () => {
    expect(displayNameFromClaims({ user_metadata: { full_name: '   ' }, name: '' })).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(displayNameFromClaims({ user_metadata: { full_name: '  Ama Mensah \n' } })).toBe(
      'Ama Mensah'
    );
  });

  it('ignores a non-string name rather than coercing it', () => {
    // `user_metadata` is writable by the user via auth.updateUser({ data }),
    // so it can hold anything at all. Nothing here may throw.
    expect(displayNameFromClaims({ user_metadata: { full_name: 42 } })).toBeNull();
    expect(displayNameFromClaims({ user_metadata: { full_name: { a: 1 } } })).toBeNull();
    expect(displayNameFromClaims({ user_metadata: null })).toBeNull();
    expect(displayNameFromClaims({ user_metadata: 'not an object' })).toBeNull();
    expect(displayNameFromClaims({})).toBeNull();
  });
});
