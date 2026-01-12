import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { attendance, CreateAttendanceSchema, UpdateAttendanceSchema } from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';

const attendanceRouter = new Hono();

// Mount standard CRUD
attendanceRouter.route('/', createCrudRoute({
  table: attendance,
  createSchema: CreateAttendanceSchema,
  updateSchema: UpdateAttendanceSchema,
  sortField: attendance.checkInTime,
  allowedFilters: ['eventId', 'patronId'],
  transformBody: (body) => ({
    ...body,
    checkInTime: body.checkInTime ? new Date(body.checkInTime) : undefined,
    checkOutTime: body.checkOutTime ? new Date(body.checkOutTime) : undefined,
  })
}));

// Custom routes
// GET /event/:eventId/stats - Get event attendance stats
attendanceRouter.get('/event/:eventId/stats', async (c) => {
  try {
    const db = await getDatabase();
    const eventId = c.req.param('eventId');

    const records = await db
      .select()
      .from(attendance)
      .where(eq(attendance.eventId, eventId));

    const stats = {
      total: records.length,
      attended: records.filter(r => r.attended).length,
      checkedIn: records.filter(r => r.checkInTime !== null).length,
      checkedOut: records.filter(r => r.checkOutTime !== null).length,
    };

    return c.json(stats);
  } catch (error) {
    console.error('Error fetching event stats:', error);
    return c.json({ error: 'Failed to fetch event statistics' }, 500);
  }
});

export default attendanceRouter;
