/**
 * BillingService — plan changes.
 *
 * **There is no payment processor here.** D15 deferred Stripe, and nothing in
 * this file talks to one: `changePlan` writes `organizations.plan` and that is
 * the whole transaction. No card number reaches this service, and none should —
 * the checkout screen in the web app generates a fake card locally and throws it
 * away. Accepting a real PAN on this endpoint would put the service in PCI scope
 * for a feature that charges nobody.
 *
 * That makes the endpoint an **entitlement grant**, so it is gated like one:
 * `org:billing`, which only an `owner` holds. When a processor is wired in, the
 * change is that `changePlan` stops being callable directly and becomes the
 * thing a verified webhook calls after a payment settles. The plan catalogue
 * (`authz/plans.ts`) and every entitlement check downstream stay put.
 *
 * No framework imports (rule 5).
 */

import { and, eq, isNull } from 'drizzle-orm';
import { organizations } from '@credopass/lib/schemas/tables';
import type { Database } from '../db/client';
import { ProblemCode, problem } from '../http/problem';
import { ORG_PLANS, type OrgPlan } from '../authz/plans';

export interface PlanChange {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  /** The plan it was on before, so the UI can say what actually happened. */
  previousPlan: OrgPlan;
}

const isPlan = (value: string): value is OrgPlan =>
  (ORG_PLANS as readonly string[]).includes(value);

/**
 * Move an organisation onto a plan.
 *
 * Idempotent: asking for the plan you are already on succeeds and reports the
 * same value for `plan` and `previousPlan`. A double-submitted checkout form is
 * a normal thing to happen, not a conflict.
 */
export async function changePlan(
  db: Database,
  organizationId: string,
  plan: string
): Promise<PlanChange> {
  if (!isPlan(plan)) {
    throw problem.badRequest(
      ProblemCode.VALIDATION_FAILED,
      `Unknown plan "${plan}". Expected one of: ${ORG_PLANS.join(', ')}.`
    );
  }

  const [current] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)))
    .limit(1);

  if (!current) throw problem.notFound(ProblemCode.NOT_FOUND, 'Organization not found.');

  const [updated] = await db
    .update(organizations)
    .set({ plan, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    plan: updated.plan,
    previousPlan: current.plan,
  };
}
