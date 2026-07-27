/**
 * Attendance write paths. docs/API-FIRST-REBUILD.md §5.6
 *
 * `POST /events/{id}/check-in` is the kiosk's ONE endpoint — scan, manual and
 * walk-in all land here, and the server decides which happened. The client
 * stopped being the thing that knows whether a person exists.
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
import * as Attendance from '../../../services/attendance';

export const attendanceRoutes = new OpenAPIHono<{ Variables: CallerVars }>();

attendanceRoutes.use('/events/:id/register', requireCaller, requireTenant());
attendanceRoutes.use('/events/:id/check-in', requireCaller, requireTenant());
attendanceRoutes.use('/events/:id/check-out', requireCaller, requireTenant());
attendanceRoutes.use('/events/:id/checkin-state', requireCaller, requireTenant());
attendanceRoutes.use('/events/:id/close', requireCaller, requireTenant());

const IdParam = z.object({ id: z.string().uuid() });

/**
 * Whom to record. Exactly one form — a union rather than three optional fields,
 * so "personId AND a walk-in name" cannot be expressed at all.
 */
const PersonRefSchema = z.union([
  z.object({ personId: z.string().uuid() }),
  z.object({ pass: z.string().min(8) }),
  z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().optional(),
  }),
]);

const AttendanceResultSchema = z
  .object({
    attendance: z.object({
      id: z.string().uuid(),
      eventId: z.string().uuid(),
      personId: z.string().uuid(),
      state: z.string(),
      checkInTime: z.string().nullable(),
      registeredAt: z.string().nullable(),
    }),
    person: z.object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().nullable(),
    }),
    /** True when this person was already present — the call changed nothing. */
    alreadyRecorded: z.boolean(),
    liveCount: z.number().int(),
  })
  .openapi('AttendanceResult');

const originOf = (url: string): string => new URL(url).origin;

attendanceRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/events/{id}/register',
    scope: 'organization',
    permission: 'attendance:record',
    summary: 'Register someone (staff-side). Issues a pass; does not mark them present.',
    tags: ['Attendance'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('attendance:record')] as const,
    request: {
      params: IdParam,
      body: { content: { 'application/json': { schema: PersonRefSchema } } },
    },
    responses: {
      201: {
        description: 'Registered. `pass.url` is durable and safe to email.',
        content: {
          'application/json': {
            schema: AttendanceResultSchema.extend({
              pass: z.object({
                url: z.string(),
                token: z.string(),
                expiresAt: z.string(),
              }),
            }),
          },
        },
      },
      400: problemResponse('Invalid body or pass'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('Event or person not found'),
      409: problemResponse('Event finished, or capacity reached'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const result = await Attendance.register(db, {
      eventId: c.req.valid('param').id,
      organizationId: c.get('tenant').organizationId,
      person: c.req.valid('json'),
      origin: originOf(c.req.url),
    });
    return c.json(result, 201);
  }
);

attendanceRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/events/{id}/check-in',
    scope: 'organization',
    permission: 'attendance:record',
    summary: 'Record someone present. Idempotent — a second call does not move check_in_time.',
    tags: ['Attendance'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('attendance:record')] as const,
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.intersection(
              PersonRefSchema,
              z.object({ method: z.enum(['qr', 'manual', 'self', 'pass']).default('manual') })
            ),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Recorded, or already recorded',
        content: { 'application/json': { schema: AttendanceResultSchema } },
      },
      400: problemResponse('Invalid body or pass'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('Event or person not found'),
      409: problemResponse('Event finished, or capacity reached'),
    },
  }),
  async (c) => {
    const body = c.req.valid('json') as Attendance.PersonRef & { method?: Attendance.CheckInMethod };
    const db = await getDatabase();
    const tenant = c.get('tenant');

    const result = await Attendance.checkIn(db, {
      eventId: c.req.valid('param').id,
      organizationId: tenant.organizationId,
      person: body,
      method: body.method ?? 'manual',
      actor: { accountId: tenant.accountId },
    });
    return c.json(result, 200);
  }
);

attendanceRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/events/{id}/check-out',
    scope: 'organization',
    permission: 'attendance:record',
    summary: 'Record someone leaving (require_check_out)',
    tags: ['Attendance'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('attendance:record')] as const,
    request: {
      params: IdParam,
      body: { content: { 'application/json': { schema: PersonRefSchema } } },
    },
    responses: {
      200: { description: 'Checked out', content: { 'application/json': { schema: AttendanceResultSchema } } },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not checked in'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const result = await Attendance.checkOut(db, {
      eventId: c.req.valid('param').id,
      organizationId: c.get('tenant').organizationId,
      person: c.req.valid('json'),
    });
    return c.json(result, 200);
  }
);

attendanceRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/events/{id}/checkin-state',
    scope: 'organization',
    permission: 'attendance:read',
    summary: 'The kiosk counter. Live and shared, not per-tab useState.',
    tags: ['Attendance'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('attendance:read')] as const,
    request: { params: IdParam },
    responses: {
      200: {
        description: 'Counts',
        content: {
          'application/json': {
            schema: z.object({
              checkedIn: z.number().int(),
              registered: z.number().int(),
              capacity: z.number().int().nullable(),
              remaining: z.number().int().nullable(),
            }),
          },
        },
      },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Event not found'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const state = await Attendance.checkInState(
      db,
      c.req.valid('param').id,
      c.get('tenant').organizationId
    );
    return c.json(state, 200);
  }
);

attendanceRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/events/{id}/close',
    scope: 'organization',
    permission: 'event:update',
    summary: 'Close an event and finalise no-shows as recorded facts',
    tags: ['Attendance'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('event:update')] as const,
    request: { params: IdParam },
    responses: {
      200: {
        description: 'Closed. Idempotent.',
        content: {
          'application/json': {
            schema: z.object({ closedAt: z.string(), noShows: z.number().int() }),
          },
        },
      },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Event not found'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const result = await Attendance.closeEvent(
      db,
      c.req.valid('param').id,
      c.get('tenant').organizationId
    );
    return c.json(result, 200);
  }
);
