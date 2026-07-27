/**
 * What a plan entitles an account to.
 *
 * Kept as data in one table rather than scattered `if (plan === 'pro')` checks,
 * because the numbers are expected to move with pricing. Changing what a tier
 * allows should be an edit here and nothing else.
 *
 * The limit counts organisations an account OWNS, not ones it belongs to.
 * Being invited into someone else's organisation costs the invitee nothing —
 * otherwise a popular volunteer would be locked out of accepting invitations.
 *
 * Every account gets one organisation automatically on first sign-in, so a
 * `free` limit of 2 means "yours, plus one more you make yourself".
 */

export const ORG_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const;
export type OrgPlan = (typeof ORG_PLANS)[number];

export const DEFAULT_PLAN: OrgPlan = 'free';

/** Maximum organisations an account may OWN, by its best plan. */
export const OWNED_ORG_LIMIT: Record<OrgPlan, number> = {
  free: 2,
  starter: 5,
  pro: 25,
  // Not unlimited: `Infinity` would mean a billing bug could mint organisations
  // without bound. A number this large is effectively no limit for a real
  // customer, and still a limit.
  enterprise: 1000,
};

const isPlan = (value: string): value is OrgPlan =>
  (ORG_PLANS as readonly string[]).includes(value);

/**
 * The entitlement an account is actually operating under.
 *
 * An account can own several organisations on different plans, so the best one
 * wins. The alternative — the plan of whichever organisation happens to be
 * active — would mean the same button works or fails depending on which
 * organisation is selected, which nobody could reason about.
 */
export function bestPlan(plans: readonly string[]): OrgPlan {
  let best: OrgPlan = DEFAULT_PLAN;
  for (const raw of plans) {
    const plan = raw.toLowerCase();
    if (!isPlan(plan)) continue;
    if (OWNED_ORG_LIMIT[plan] > OWNED_ORG_LIMIT[best]) best = plan;
  }
  return best;
}

export const orgLimitFor = (plans: readonly string[]): number =>
  OWNED_ORG_LIMIT[bestPlan(plans)];
