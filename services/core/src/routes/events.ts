import { Hono } from 'hono';
import { events, CreateEventSchema, UpdateEventSchema } from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';

const eventsRouter = new Hono();

eventsRouter.route('/', createCrudRoute({
  table: events,
  createSchema: CreateEventSchema,
  updateSchema: UpdateEventSchema,
  sortField: events.startTime,
  allowedFilters: ['status', 'organizationId'],
  transformBody: (body) => ({
    ...body,
    startTime: body.startTime ? new Date(body.startTime) : undefined,
    endTime: body.endTime ? new Date(body.endTime) : undefined,
    // Ensure checkInMethods is an array
    checkInMethods: body.checkInMethods || ['qr'],
  })
}));

export default eventsRouter;
