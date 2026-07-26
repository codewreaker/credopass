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


// ---------------------------------------------------------------------------
// Writes (§5.5)
// ---------------------------------------------------------------------------

const PersonBody = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().nullish(),
  phone: z.string().max(50).nullish(),
  notes: z.string().max(5000).nullish(),
});

const PersonSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  })
  .openapi('PersonCreated');

peopleRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/people',
    scope: 'organization',
    permission: 'person:create',
    summary: 'Add someone to the roll',
    tags: ['People'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('person:create')] as const,
    request: { body: { content: { 'application/json': { schema: PersonBody } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: PersonSchema } } },
      400: problemResponse('Invalid body'),
      403: problemResponse('Insufficient role'),
      409: problemResponse('That email is already on this roll'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const person = await People.createPerson(db, c.get('tenant'), c.req.valid('json'));
    return c.json(person, 201);
  }
);

peopleRoutes.openapi(
  defineRoute({
    method: 'patch',
    path: '/people/{id}',
    scope: 'organization',
    permission: 'person:update',
    summary: 'Update someone on the roll',
    tags: ['People'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('person:update')] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: PersonBody.partial().omit({ id: true }) } } },
    },
    responses: {
      200: {
        description: 'Updated',
        content: {
          'application/json': {
            schema: z.object({
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
            }),
          },
        },
      },
      400: problemResponse('Invalid body'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or in another organization'),
      409: problemResponse('That email is already on this roll'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const person = await People.updatePerson(
      db,
      c.get('tenant'),
      c.req.valid('param').id,
      c.req.valid('json')
    );
    return c.json(person, 200);
  }
);

peopleRoutes.openapi(
  defineRoute({
    method: 'delete',
    path: '/people/{id}',
    scope: 'organization',
    permission: 'person:delete',
    summary: 'Remove from the roll. Soft — attendance history survives.',
    tags: ['People'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('person:delete')] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      204: { description: 'Removed' },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or in another organization'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    await People.deletePerson(db, c.get('tenant'), c.req.valid('param').id);
    return c.body(null, 204);
  }
);
