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


// ---------------------------------------------------------------------------
// Writes (§5.3)
// ---------------------------------------------------------------------------

const EventBody = z.object({
  /** Client-generated UUIDv7 is honoured (D11) — the server does not mint its own. */
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullish(),
  startAt: z.string().datetime(),
  /** Omit and it becomes start + 1h at WRITE time, so no reader has to guess. */
  endAt: z.string().datetime().nullish(),
  timezone: z.string().max(64).optional(),
  locationText: z.string().min(1).max(300),
  capacity: z.number().int().positive().nullish(),
  enforceCapacity: z.boolean().optional(),
  checkInMethods: z.array(z.enum(['qr', 'manual', 'self', 'pass'])).optional(),
  requireCheckOut: z.boolean().optional(),
  allowSelfCheckIn: z.boolean().optional(),
});

const toInput = (b: z.infer<typeof EventBody>) => ({
  ...b,
  startAt: new Date(b.startAt),
  endAt: b.endAt ? new Date(b.endAt) : null,
});

eventRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/events',
    scope: 'organization',
    permission: 'event:create',
    summary: 'Create an event',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:create')] as const,
    request: { body: { content: { 'application/json': { schema: EventBody } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: EventSummarySchema } } },
      400: problemResponse('Invalid body, or end before start'),
      403: problemResponse('Insufficient role'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const event = await Events.createEvent(db, c.get('tenant'), toInput(c.req.valid('json')));
    return c.json(event, 201);
  }
);

eventRoutes.openapi(
  defineRoute({
    method: 'patch',
    path: '/events/{id}',
    scope: 'organization',
    permission: 'event:update',
    summary: 'Update an event',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:update')] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: EventBody.partial().omit({ id: true }) } } },
    },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: EventSummarySchema } } },
      400: problemResponse('Invalid body'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or in another organization'),
    },
  }),
  async (c) => {
    const b = c.req.valid('json');
    const db = await getDatabase();
    // Dates arrive as ISO strings and the service takes Date objects, so the
    // two date fields are converted explicitly rather than spread through.
    const { startAt, endAt, ...rest } = b;
    const event = await Events.updateEvent(db, c.get('tenant'), c.req.valid('param').id, {
      ...rest,
      ...(startAt ? { startAt: new Date(startAt) } : {}),
      ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
    });
    return c.json(event, 200);
  }
);

eventRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/events/{id}/cancel',
    scope: 'organization',
    permission: 'event:cancel',
    summary: 'Cancel an event. Keeps its attendance, its URL and its history.',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:cancel')] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({ reason: z.string().max(500).optional() }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cancelled. Idempotent — cancelling twice is not an error.',
        content: { 'application/json': { schema: EventSummarySchema } },
      },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or in another organization'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const event = await Events.cancelEvent(
      db,
      c.get('tenant'),
      c.req.valid('param').id,
      c.req.valid('json').reason
    );
    return c.json(event, 200);
  }
);

eventRoutes.openapi(
  defineRoute({
    method: 'delete',
    path: '/events/{id}',
    scope: 'organization',
    permission: 'event:delete',
    summary: 'Soft-delete. Refused once anyone has registered — cancel instead.',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:delete')] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      204: { description: 'Deleted' },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or in another organization'),
      409: problemResponse('People have registered'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    await Events.deleteEvent(db, c.get('tenant'), c.req.valid('param').id);
    return c.body(null, 204);
  }
);
