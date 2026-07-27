/**
 * Plan entitlements — pure policy, no DB.
 *
 * These numbers move with pricing, so the tests assert the RULES (best plan
 * wins, unknown plans are ignored, free allows a second organisation) rather
 * than pinning every figure. A test that just restates the table would have to
 * be edited every time the table is, and would catch nothing.
 */

import { describe, expect, it } from 'bun:test';
import { DEFAULT_PLAN, OWNED_ORG_LIMIT, bestPlan, orgLimitFor } from '../authz/plans';

describe('bestPlan', () => {
  it('falls back to free for an account that owns nothing', () => {
    expect(bestPlan([])).toBe(DEFAULT_PLAN);
  });

  it('takes the most generous plan, not the first or the active one', () => {
    // Whichever organisation happens to be selected must not change what the
    // account may do — otherwise the same button works or fails at random.
    expect(bestPlan(['free', 'pro', 'free'])).toBe('pro');
    expect(bestPlan(['pro', 'free'])).toBe('pro');
  });

  it('ignores a plan it does not recognise rather than trusting it', () => {
    expect(bestPlan(['unlimited-mega'])).toBe(DEFAULT_PLAN);
    expect(bestPlan(['free', 'not-a-plan'])).toBe(DEFAULT_PLAN);
  });

  it('is case-insensitive about what the column holds', () => {
    expect(bestPlan(['PRO'])).toBe('pro');
  });
});

describe('orgLimitFor', () => {
  it('lets a free account own its own organisation plus one more', () => {
    // The first is auto-provisioned, so a limit of 2 is the promise that a free
    // account can create exactly one additional organisation.
    expect(orgLimitFor([])).toBe(2);
    expect(OWNED_ORG_LIMIT.free).toBe(2);
  });

  it('gives every paid tier strictly more than free', () => {
    for (const plan of ['starter', 'pro', 'enterprise'] as const) {
      expect(OWNED_ORG_LIMIT[plan]).toBeGreaterThan(OWNED_ORG_LIMIT.free);
    }
  });

  it('has no unbounded tier — a billing bug must not mint organisations forever', () => {
    for (const limit of Object.values(OWNED_ORG_LIMIT)) {
      expect(Number.isFinite(limit)).toBe(true);
    }
  });
});
