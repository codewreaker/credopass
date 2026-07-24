import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { attendance, events, organizations, users } from '@credopass/lib/schemas';

/**
 * Token-optional public surface for the attendee-facing event page.
 *
 * This router is mounted BEFORE the auth middleware (see index.ts) so it is
 * reachable with no Supabase JWT — that is the whole point of a shareable event
 * link/QR. It exposes exactly two things and nothing else:
 *
 *   GET  /public/events/:id          → read-only public fields for one event
 *   POST /public/events/:id/attend   → register (attended=false) or check in
 *                                        (attended=true) for that one event
 *
 * Everything is scoped to a single event id in the path; there is no way to list
 * events, read other tenants' data, or touch anything but the (event, patron)
 * attendance row the caller is creating for themselves.
 */
const publicRouter = new Hono();

type EventRow = typeof events.$inferSelect;

/**
 * Derive the live status from the event window — the server-side twin of the
 * client's `getStatus` (packages/api-client/src/collections/events.ts). The
 * public CTA (register vs check-in vs "ended") keys off this, so it must match.
 */
function deriveStatus(start: Date | null, end: Date | null, status: EventRow['status']): EventRow['status'] {
  if (status === 'cancelled' || status === 'draft' || status === 'completed') return status;
  const now = Date.now();
  const startedAt = start?.getTime();
  if (!startedAt || !Number.isFinite(startedAt)) return status;
  if (now < startedAt) return 'scheduled';
  const endedAt = end?.getTime();
  const finishedAt = endedAt && Number.isFinite(endedAt) ? endedAt : startedAt + 60 * 60 * 1000;
  return now <= finishedAt ? 'ongoing' : 'completed';
}

/** The minimal, non-sensitive projection the public page renders. */
function toPublicEvent(event: EventRow, organizationName: string | null) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    location: event.location,
    startTime: event.startTime,
    endTime: event.endTime,
    capacity: event.capacity,
    status: deriveStatus(event.startTime, event.endTime, event.status),
    organizationId: event.organizationId,
    organizationName,
  };
}

async function loadEvent(id: string): Promise<EventRow | null> {
  const db = await getDatabase();
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
}

// GET /public/events/:id — one event, read-only, no auth.
publicRouter.get('/events/:id', async (c) => {
  try {
    const event = await loadEvent(c.req.param('id'));
    if (!event) return c.json({ error: 'Event not found' }, 404);

    let organizationName: string | null = null;
    if (event.organizationId) {
      const db = await getDatabase();
      const org = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, event.organizationId))
        .limit(1);
      organizationName = org[0]?.name ?? null;
    }

    return c.json(toPublicEvent(event, organizationName));
  } catch (error) {
    console.error('GET /public/events/:id', error);
    return c.json({ error: 'Failed to load event' }, 500);
  }
});

const AttendSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('A valid email is required'),
  /** `register` = an RSVP (attended=false); `checkin` = arrived (attended=true). */
  mode: z.enum(['register', 'checkin']).default('checkin'),
  method: z.enum(['qr', 'manual', 'external_auth']).default('manual'),
});

// POST /public/events/:id/attend — self-service register or check-in.
publicRouter.post('/events/:id/attend', async (c) => {
  try {
    const parsed = AttendSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'Invalid details', details: parsed.error.issues }, 400);
    }
    const { firstName, lastName, email, mode, method } = parsed.data;
    const wantAttended = mode === 'checkin';

    const event = await loadEvent(c.req.param('id'));
    if (!event) return c.json({ error: 'Event not found' }, 404);

    // Registration/check-in only make sense while the event is open. A completed
    // or cancelled event rejects new attendance rather than silently recording one.
    const status = deriveStatus(event.startTime, event.endTime, event.status);
    if (status === 'completed' || status === 'cancelled') {
      return c.json({ error: 'This event has ended' }, 409);
    }

    const db = await getDatabase();
    const normalisedEmail = email.toLowerCase();

    // Find the patron by email, else create one.
    let patron = (
      await db.select().from(users).where(eq(users.email, normalisedEmail)).limit(1)
    )[0];
    if (!patron) {
      const now = new Date();
      patron = (
        await db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            email: normalisedEmail,
            firstName,
            lastName,
            phone: null,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
      )[0];
    }

    // One attendance row per (event, patron). Register creates it as attended=false;
    // a later check-in flips it true without losing the original registration.
    const existing = (
      await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.eventId, event.id), eq(attendance.patronId, patron.id)))
        .limit(1)
    )[0];

    const now = new Date();

    if (existing) {
      if (wantAttended && !existing.attended) {
        const updated = (
          await db
            .update(attendance)
            .set({ attended: true, checkInTime: existing.checkInTime ?? now, checkInMethod: method })
            .where(eq(attendance.id, existing.id))
            .returning()
        )[0];
        return c.json({
          userId: patron.id,
          attendanceId: updated.id,
          attended: true,
          mode,
          alreadyExisted: true,
        });
      }
      return c.json({
        userId: patron.id,
        attendanceId: existing.id,
        attended: existing.attended,
        mode,
        alreadyExisted: true,
      });
    }

    const inserted = (
      await db
        .insert(attendance)
        .values({
          id: crypto.randomUUID(),
          organizationId: event.organizationId,
          eventId: event.id,
          patronId: patron.id,
          attended: wantAttended,
          checkInTime: wantAttended ? now : null,
          checkOutTime: null,
          checkInMethod: wantAttended ? method : null,
          notes: null,
        })
        .returning()
    )[0];

    return c.json({
      userId: patron.id,
      attendanceId: inserted.id,
      attended: wantAttended,
      mode,
      alreadyExisted: false,
    });
  } catch (error) {
    console.error('POST /public/events/:id/attend', error);
    return c.json({ error: 'Failed to record attendance' }, 500);
  }
});

export default publicRouter;
