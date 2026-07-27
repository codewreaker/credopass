/**
 * `guestDisplayName` — the label an anonymous caller gets.
 *
 * Anonymous sign-ins assert no `name` claim, so without this every guest is
 * nameless in the UI. The label is derived from the subject, never random, so
 * the same anonymous user reads the same way twice.
 *
 * These are unit tests: no DB, no framework, per the "must always pass" rule.
 */

import { describe, expect, it } from 'bun:test';
import { guestDisplayName } from '../services/identity';

describe('guestDisplayName', () => {
  it('reads as a name, not an identifier', () => {
    expect(guestDisplayName('c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f')).toMatch(/^Guest \d{4}$/);
  });

  it('is deterministic — the same subject always gets the same label', () => {
    const subject = 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
    expect(guestDisplayName(subject)).toBe(guestDisplayName(subject));
  });

  it('distinguishes different subjects', () => {
    // Not a guarantee of the function — four digits collide by design — but a
    // regression guard against it degenerating to a constant.
    const labels = new Set(
      Array.from({ length: 50 }, (_, i) => guestDisplayName(`subject-${i}`))
    );
    expect(labels.size).toBeGreaterThan(40);
  });

  it('always pads to four digits', () => {
    // A short subject hashes low; the label must not come out as `Guest 7`.
    for (const subject of ['a', 'b', '', 'xy']) {
      expect(guestDisplayName(subject)).toMatch(/^Guest \d{4}$/);
    }
  });
});
