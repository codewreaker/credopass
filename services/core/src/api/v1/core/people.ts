/**
 * People read paths. docs/API-FIRST-REBUILD.md §5.5
 *
 * `standing` and `eventsAttended` arrive already decided — the client renders
 * them, it does not compute them.
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
import { STANDINGS } from '../../../services/people';
import * as People from '../../../services/people';

export const peopleRoutes = new OpenAPIHono<{ Variables: CallerVars }>();

peopleRoutes.use('/people', requireCaller, requireTenant());
peopleRoutes.use('/people/*', requireCaller, requireTenant());

const PersonRowSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    standing: z.enum(STANDINGS),
    eventsAttended: z.number().int(),
    checkInTime: z.string().nullable(),
  })
  .openapi('PersonRow');

peopleRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/people',
    scope: 'organization',
    permission: 'person:read',
    summary: 'The org roll, with standing and lifetime counts',
    tags: ['People'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('person:read')] as const,
    request: {
      query: z.object({
        q: z.string().max(200).optional(),
        // Scoping to an event changes `standing` from lifetime to that event.
        eventId: z.string().uuid().optional(),
        standing: z.enum(STANDINGS).optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
    },
    responses: {
      200: {
        description: 'A page of people',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(PersonRowSchema),
              page: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
            }),
          },
        },
      },
      400: problemResponse('Invalid query'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('Scoped event not found'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    return c.json(await People.listPeople(db, c.get('tenant'), c.req.valid('query')), 200);
  }
);

peopleRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/people/summary',
    scope: 'organization',
    permission: 'person:read',
    summary: 'The billboard tiles on /attendees',
    tags: ['People'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('person:read')] as const,
    request: { query: z.object({ eventId: z.string().uuid().optional() }) },
    responses: {
      200: {
        description: 'Counts',
        content: {
          'application/json': {
            schema: z.object({
              total: z.number().int(),
              attended: z.number().int(),
              signedUp: z.number().int(),
              noShows: z.number().int(),
            }),
          },
        },
      },
      403: problemResponse('Insufficient role'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    return c.json(await People.summary(db, c.get('tenant'), c.req.valid('query').eventId), 200);
  }
);

// After /people/summary — Hono matches in registration order.
peopleRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/people/{id}',
    scope: 'organization',
    permission: 'person:read',
    summary: 'One person, with lifetime stats',
    tags: ['People'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('person:read')] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: 'The person',
        content: {
          'application/json': {
            schema: z
              .object({
                id: z.string().uuid(),
                firstName: z.string(),
                lastName: z.string(),
                email: z.string().nullable(),
                phone: z.string().nullable(),
                notes: z.string().nullable(),
                createdAt: z.string(),
                stats: z.object({
                  eventsAttended: z.number().int(),
                  eventsRegistered: z.number().int(),
                }),
              })
              .openapi('Person'),
          },
        },
      },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or in another organization'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    return c.json(await People.getPerson(db, c.get('tenant'), c.req.valid('param').id), 200);
  }
);
