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

/**
 * What a tier is called, what it costs, and what you get — served over the API
 * as `GET /plans`.
 *
 * It lives beside the limits rather than in the web app for the reason the old
 * `/upgrade` screen spelled out: a copy of these numbers in a React component is
 * wrong on the day pricing changes, and nobody remembers to look for it. The
 * pricing page, the upgrade screen and any future marketing surface all read
 * the same row.
 *
 * `priceMonthly` is in minor units (pence/cents) — never a float. `null` means
 * "talk to us" rather than free; `free` is `0`.
 */
export interface PlanDefinition {
  id: OrgPlan;
  name: string;
  /** One line, shown under the plan name. */
  tagline: string;
  /** Minor units per month, or null when the price is negotiated. */
  priceMonthly: number | null;
  currency: 'GBP';
  /** Organisations this tier may own — the one hard entitlement in the code. */
  ownedOrgLimit: number;
  /**
   * Does this tier see the full analytics dashboard?
   *
   * Shipped as a field so the web app can gate on it instead of testing
   * `plan !== 'free'` itself. Which tiers include analytics is a pricing
   * decision, and a copy of that decision in a React component is one more
   * thing to remember on the day pricing moves.
   */
  fullAnalytics: boolean;
  features: string[];
}

/** The catalogue minus the fields derived below, which are never restated. */
type PlanCopy = Omit<PlanDefinition, 'ownedOrgLimit' | 'fullAnalytics'>;

const PLAN_COPY: readonly PlanCopy[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Run your first events and see who actually turns up.',
    priceMonthly: 0,
    currency: 'GBP',
    features: [
      'Unlimited events',
      'QR, manual and walk-in check-in',
      'Attendance records that persist',
      'Public event pages',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For a growing programme with a team on the door.',
    priceMonthly: 1900,
    currency: 'GBP',
    features: [
      'Everything in Free',
      'Up to 5 organisations',
      'Invite staff with door-only access',
      'Attendance analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Full analytics and exports across every event you run.',
    priceMonthly: 4900,
    currency: 'GBP',
    features: [
      'Everything in Starter',
      'Up to 25 organisations',
      'Full analytics dashboard',
      'CSV and PDF export',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For institutions running attendance at scale.',
    priceMonthly: null,
    currency: 'GBP',
    features: [
      'Everything in Pro',
      'Effectively unlimited organisations',
      'SSO via your own identity provider',
      'Custom retention and data residency',
    ],
  },
];

/**
 * Which tiers unlock the full analytics dashboard.
 *
 * Named rather than written as `plan !== 'free'` at the call site, because the
 * answer is a pricing decision and pricing decisions belong in this file.
 */
export const ANALYTICS_PLANS: readonly OrgPlan[] = ['starter', 'pro', 'enterprise'];

export const hasFullAnalytics = (plan: string): boolean =>
  (ANALYTICS_PLANS as readonly string[]).includes(plan.toLowerCase());

/**
 * The catalogue as served. `ownedOrgLimit` and `fullAnalytics` are read from
 * the tables above rather than written out again — what the API advertises and
 * what the code enforces are then the same values by construction, and cannot
 * disagree the way two hand-maintained lists eventually do.
 */
export const PLAN_CATALOGUE: readonly PlanDefinition[] = PLAN_COPY.map((copy) => ({
  ...copy,
  ownedOrgLimit: OWNED_ORG_LIMIT[copy.id],
  fullAnalytics: hasFullAnalytics(copy.id),
}));

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
