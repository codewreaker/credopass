/**
 * Event read paths. docs/API-FIRST-REBUILD.md §5.3
 *
 * Every value these return is DECIDED here — status, counts, organisation name,
 * the upcoming/past split, the calendar grouping. There is nothing left for the
 * client to derive, which is the point of rule 5.
 *
 * Writes land in Phase 3.
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
import { EVENT_STATUSES } from '../../../services/event-status';
import * as Events from '../../../services/event';

export const eventRoutes = new OpenAPIHono<{ Variables: CallerVars }>();

eventRoutes.use('/events', requireCaller, requireTenant());
eventRoutes.use('/events/*', requireCaller, requireTenant());

const EventSummarySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    /** Derived server-side from timestamps — never stored, never stale (D2). */
    status: z.enum(EVENT_STATUSES),
    startAt: z.string(),
    endAt: z.string(),
    location: z.string(),
    capacity: z.number().int().nullable(),
    organizationId: z.string().uuid(),
    organizationName: z.string(),
    shortCode: z.string(),
    counts: z.object({ registered: z.number().int(), attended: z.number().int() }),
    cancellationReason: z.string().nullish(),
  })
  .openapi('EventSummary');

const PageSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

/**
 * `?status=` accepts a repeated or comma-separated list. An unknown value is a
 * 400 rather than being silently dropped (§5.0) — the opposite of the current
 * `allowedFilters` behaviour, where a typo quietly returns everything.
 */
const StatusListQuery = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined))
  .pipe(z.array(z.enum(EVENT_STATUSES)).optional());

eventRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/events',
    scope: 'organization',
    permission: 'event:read',
    summary: 'List events (status derived, counts included)',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:read')] as const,
    request: {
      query: z.object({
        group: z.enum(['upcoming', 'past']).optional(),
        status: StatusListQuery,
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        q: z.string().max(200).optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
    },
    responses: {
      200: {
        description: 'A page of events',
        content: {
          'application/json': {
            schema: z.object({ data: z.array(EventSummarySchema), page: PageSchema }),
          },
        },
      },
      400: problemResponse('Invalid query'),
      403: problemResponse('Insufficient role'),
    },
  }),
  async (c) => {
    const q = c.req.valid('query');
    const db = await getDatabase();
    const result = await Events.listEvents(db, c.get('tenant'), {
      group: q.group,
      status: q.status,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      q: q.q,
      cursor: q.cursor,
      limit: q.limit,
    });
    return c.json(result, 200);
  }
);

eventRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/events/summary',
    scope: 'organization',
    permission: 'event:read',
    summary: 'Counts and the spotlight event for the /events hero',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:read')] as const,
    responses: {
      200: {
        description: 'Summary',
        content: {
          'application/json': {
            schema: z.object({
              total: z.number().int(),
              upcoming: z.number().int(),
              ongoing: z.number().int(),
              next: EventSummarySchema.nullable(),
            }),
          },
        },
      },
      403: problemResponse('Insufficient role'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    return c.json(await Events.summary(db, c.get('tenant')), 200);
  }
);

eventRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/events/calendar',
    scope: 'organization',
    permission: 'event:read',
    summary: 'One month of events, grouped by day (the calendar rail)',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:read')] as const,
    request: {
      query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM') }),
    },
    responses: {
      200: {
        description: 'Days with events',
        content: {
          'application/json': {
            schema: z.object({
              month: z.string(),
              days: z.array(z.object({ date: z.string(), events: z.array(EventSummarySchema) })),
            }),
          },
        },
      },
      400: problemResponse('Invalid month'),
      403: problemResponse('Insufficient role'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const result = await Events.calendarMonth(db, c.get('tenant'), c.req.valid('query').month);
    return c.json(result, 200);
  }
);

// Registered AFTER /events/summary and /events/calendar. Hono matches in
// registration order, so a `{id}` route declared first would swallow both.
eventRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/events/{id}',
    scope: 'organization',
    permission: 'event:read',
    summary: 'One event',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:read')] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: 'The event',
        content: { 'application/json': { schema: EventSummarySchema } },
      },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or in another organization'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const event = await Events.getEvent(db, c.get('tenant'), c.req.valid('param').id);
    return c.json(event, 200);
  }
);
