/**
 * Plans and plan changes.
 *
 * **Nothing here charges anyone.** D15 deferred Stripe. `PUT /organizations/{id}/plan`
 * writes a column and returns — it is an entitlement grant with a billing-shaped
 * name, and the web app's checkout screen in front of it is explicitly a mock.
 *
 * Two consequences that are deliberate, not oversights:
 *
 *   · **No card details are accepted.** The request body carries a plan id and
 *     nothing else. A `cardNumber` field here would put the service in PCI scope
 *     to collect a number it would immediately discard.
 *   · **`org:billing` gates it**, so only an `owner` can change a plan — the same
 *     bar a real checkout would sit behind. When a processor is wired in, this
 *     handler becomes the webhook's target rather than the browser's, and the
 *     permission stays exactly as it is.
 *
 * `GET /plans` is public: pricing is public information, and the marketing site
 * should be able to read the same catalogue the app does.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { defineRoute, problemResponse } from '../../../http/define-route';
import {
  requireCaller,
  requirePermission,
  requireTenant,
  type CallerVars,
} from '../../../middleware/caller';
import { getDatabase } from '../../../db/client';
import { ORG_PLANS, PLAN_CATALOGUE } from '../../../authz/plans';
import * as Billing from '../../../services/billing';

export const billingRoutes = new OpenAPIHono<{ Variables: CallerVars }>();

billingRoutes.use('/organizations/:id/plan', requireCaller, requireTenant({ fromPathParam: 'id' }));

const PlanSchema = z
  .object({
    id: z.enum(ORG_PLANS),
    name: z.string(),
    tagline: z.string(),
    /** Minor units (pence) per month. `null` means the price is negotiated. */
    priceMonthly: z.union([z.number().int(), z.null()]),
    currency: z.literal('GBP'),
    ownedOrgLimit: z.number().int(),
    /** Gate the analytics dashboard on this, not on the plan id. */
    fullAnalytics: z.boolean(),
    features: z.array(z.string()),
  })
  .openapi('Plan');

const PlanChangeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    plan: z.enum(ORG_PLANS),
    /** What it was on before — lets the client say what actually changed. */
    previousPlan: z.enum(ORG_PLANS),
  })
  .openapi('PlanChange');

billingRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/plans',
    scope: 'public',
    summary: 'The plan catalogue — names, prices and limits',
    tags: ['Billing'],
    responses: {
      200: {
        description: 'Every plan on offer',
        content: { 'application/json': { schema: z.array(PlanSchema) } },
      },
    },
  }),
  (c) => c.json(PLAN_CATALOGUE.map((p) => ({ ...p })), 200)
);

billingRoutes.openapi(
  defineRoute({
    method: 'put',
    path: '/organizations/{id}/plan',
    scope: 'organization',
    permission: 'org:billing',
    summary: "Set an organization's plan",
    description:
      'NO PAYMENT IS TAKEN. Billing is not wired up (D15), so this grants the entitlement ' +
      'directly and is restricted to owners. Send no card details — the body is a plan id.',
    tags: ['Billing'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('org:billing')] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': { schema: z.object({ plan: z.enum(ORG_PLANS) }) },
        },
      },
    },
    responses: {
      200: {
        description: 'Plan changed (or already on it — this is idempotent)',
        content: { 'application/json': { schema: PlanChangeSchema } },
      },
      400: problemResponse('Unknown plan'),
      403: problemResponse('Not an owner of this organization'),
      404: problemResponse('Not found, or not yours'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const result = await Billing.changePlan(
      db,
      c.get('tenant').organizationId,
      c.req.valid('json').plan
    );
    return c.json(result, 200);
  }
);
