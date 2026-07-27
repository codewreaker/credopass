/**
 * Analytics. docs/API-FIRST-REBUILD.md §5.9
 *
 * **The numbers this returns are fabricated.** A deterministic generator in
 * `src/services/analytics/` invents believable attendance figures; nothing here
 * reads an `attendance` row. The response carries `fabricated: true` so that
 * fact reaches the client as data rather than as a banner someone can forget.
 *
 * The *wiring*, though, is production-shaped and worth having early: real auth,
 * real tenant resolution, a real `analytics:read` check, a real 404 when the
 * scope names an event in someone else's organisation. When aggregates land,
 * they land inside `buildAnalytics` — this file does not change.
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
import { buildAnalytics } from '../../../services/analytics';
import * as Events from '../../../services/event';

export const analyticsRoutes = new OpenAPIHono<{ Variables: CallerVars }>();

analyticsRoutes.use('/analytics/*', requireCaller, requireTenant());

const SeriesPointSchema = z.object({ label: z.string(), value: z.number() });

const StatTileSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  change: z.string(),
  trend: z.enum(['up', 'down']),
});

const AnalyticsSchema = z
  .object({
    scope: z.string(),
    range: z.enum(['week', 'month', 'year']),
    generatedAt: z.string(),
    scopeLabel: z.string(),
    /** True while the figures are invented. Render a warning when set. */
    fabricated: z.boolean(),

    kpis: z.object({
      avgAttendanceRate: z.number(),
      avgAttendanceChange: z.number(),
      totalCheckIns: z.number(),
      uniqueAttendees: z.number(),
      noShowRate: z.number(),
      repeatRate: z.number(),
      newVsReturning: z.object({ new: z.number(), returning: z.number() }),
      liveNow: z.number(),
    }),
    stats: z.array(StatTileSchema),

    attendanceTrend: z.array(SeriesPointSchema),
    checkInsSeries: z.array(SeriesPointSchema),
    attendanceMix: z.array(
      z.object({
        label: z.string(),
        members: z.number(),
        guests: z.number(),
        walkIns: z.number(),
      })
    ),
    arrivalsByHour: z.array(SeriesPointSchema),
    checkInMethods: z.array(
      z.object({ method: z.string(), label: z.string(), value: z.number() })
    ),
    funnel: z.object({
      registered: z.number(),
      checkedIn: z.number(),
      attended: z.number(),
    }),
    dwell: z.object({ avgMinutes: z.number(), medianMinutes: z.number() }),

    topEvents: z.array(
      z.object({
        name: z.string(),
        attendees: z.number(),
        fillRate: z.number(),
        trend: z.string(),
      })
    ),
    recentActivity: z.array(
      z.object({ action: z.string(), time: z.string(), highlight: z.boolean() })
    ),

    goal: z.object({ value: z.number(), target: z.number() }),
  })
  .openapi('Analytics');

analyticsRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/analytics/overview',
    scope: 'organization',
    permission: 'analytics:read',
    summary: 'Attendance analytics for the organization, or for one event',
    description:
      'Figures are currently FABRICATED — deterministic placeholders behind the real ' +
      'contract. `fabricated` is true while that is the case; clients must label the data.',
    tags: ['Analytics'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('analytics:read')] as const,
    request: {
      query: z.object({
        /** `all`, or a single event id. */
        scope: z.string().default('all'),
        range: z.enum(['week', 'month', 'year']).default('month'),
      }),
    },
    responses: {
      200: {
        description: 'Analytics payload',
        content: { 'application/json': { schema: AnalyticsSchema } },
      },
      400: problemResponse('Invalid query'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('No such event in this organization'),
    },
  }),
  async (c) => {
    const { scope, range } = c.req.valid('query');
    const tenant = c.get('tenant');

    // Resolve the label through the event service so the header reads the event
    // name rather than a uuid. Deliberately NOT wrapped in a try/catch: an
    // unknown event — or one belonging to another organisation — should 404
    // here exactly as it would anywhere else, rather than quietly degrade into
    // a generic label and serve numbers for a scope the caller cannot see.
    let scopeLabel: string | undefined;
    if (scope !== 'all') {
      const db = await getDatabase();
      scopeLabel = (await Events.getEvent(db, tenant, scope)).name;
    }

    return c.json(
      buildAnalytics({
        scope,
        range,
        scopeLabel,
        organizationId: tenant.organizationId,
      }),
      200
    );
  }
);
