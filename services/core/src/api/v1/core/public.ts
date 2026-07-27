/**
 * The attendee surface. docs/API-FIRST-REBUILD.md §5.10, D17, D19
 *
 * Someone sends you a link. You have no app, no account, and no relationship
 * with the organisation running the event. You must be able to register, get
 * something you can show at the door, and still have it tomorrow — and doing
 * all that must not make you a member of their organisation.
 *
 * Two scopes here, and they are different things:
 *
 *   scope: 'public' — no credential at all. Reaches exactly the one resource
 *                     named in the path.
 *   scope: 'bearer' — the token IN THE URL is the credential. The same trust
 *                     model as every ticket, boarding pass and password-reset
 *                     link in existence.
 *
 * Neither can write `org_memberships`: this file imports AttendanceService and
 * PassService and nothing else. Attending is not belonging (T29).
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { defineRoute, problemResponse } from '../../../http/define-route';
import { getDatabase } from '../../../db/client';
import { ProblemCode, problem } from '../../../http/problem';
import { EVENT_STATUSES } from '../../../services/event-status';
import * as Attendance from '../../../services/attendance';
import * as Pass from '../../../services/pass';
import { findRegistration, loadPublicEvent, passView } from '../../../services/public-event';

export const publicRoutes = new OpenAPIHono();

const PublicEventSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.enum(EVENT_STATUSES),
    startAt: z.string(),
    endAt: z.string(),
    timezone: z.string(),
    location: z.string(),
    organizationName: z.string(),
    allowSelfCheckIn: z.boolean(),
    capacityRemaining: z.number().int().nullable(),
    cancellationReason: z.string().nullable(),
  })
  .openapi('PublicEvent');

const originOf = (url: string): string => new URL(url).origin;

// ---------------------------------------------------------------------------
// scope: 'public'
// ---------------------------------------------------------------------------

publicRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/public/events/{id}',
    scope: 'public',
    summary: 'The shared event link. No auth, works in any browser.',
    tags: ['Public'],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: 'The event', content: { 'application/json': { schema: PublicEventSchema } } },
      404: problemResponse('No such event'),
    },
  }),
  async (c) => c.json(await loadPublicEvent(await getDatabase(), c.req.valid('param').id), 200)
);

const RegisterBody = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
});

publicRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/public/events/{id}/register',
    scope: 'public',
    summary: 'Register for an event. Returns a durable pass URL.',
    tags: ['Public'],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: RegisterBody } } },
    },
    responses: {
      201: {
        description:
          'Registered. `pass.url` is returned SYNCHRONOUSLY and always — the email is a convenience, not the mechanism.',
        content: {
          'application/json': {
            schema: z.object({
              person: z.object({ id: z.string().uuid(), firstName: z.string(), lastName: z.string() }),
              attendance: z.object({ id: z.string().uuid(), state: z.string() }),
              pass: z.object({ url: z.string(), token: z.string(), expiresAt: z.string() }),
            }),
          },
        },
      },
      400: problemResponse('Invalid body'),
      404: problemResponse('No such event'),
      409: problemResponse('Event finished, or full'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const result = await Attendance.register(db, {
      eventId: c.req.valid('param').id,
      person: c.req.valid('json'),
      origin: originOf(c.req.url),
    });

    // The pass URL is in the body BEFORE any mail is attempted (D18). A mail
    // outage degrades to "you saw your pass but the email is late" — never to a
    // failed registration.
    return c.json(
      {
        person: {
          id: result.person.id,
          firstName: result.person.firstName,
          lastName: result.person.lastName,
        },
        attendance: { id: result.attendance.id, state: result.attendance.state },
        pass: result.pass,
      },
      201
    );
  }
);

publicRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/public/events/{id}/check-in',
    scope: 'public',
    summary: 'Walk-up self check-in from the event page',
    tags: ['Public'],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.union([z.object({ pass: z.string().min(8) }), RegisterBody]),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Checked in, or already checked in',
        content: {
          'application/json': {
            schema: z.object({
              attendance: z.object({ id: z.string().uuid(), state: z.string() }),
              alreadyRecorded: z.boolean(),
            }),
          },
        },
      },
      400: problemResponse('Invalid body or pass'),
      403: problemResponse('Self check-in is disabled for this event'),
      404: problemResponse('No such event'),
      409: problemResponse('Event finished, or full'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const result = await Attendance.checkIn(db, {
      eventId: c.req.valid('param').id,
      person: c.req.valid('json'),
      method: 'self',
      // Respects allow_self_check_in — the flag exists for exactly this path.
      isSelfService: true,
    });
    return c.json(
      {
        attendance: { id: result.attendance.id, state: result.attendance.state },
        alreadyRecorded: result.alreadyRecorded,
      },
      200
    );
  }
);

publicRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/public/events/{id}/resend-pass',
    scope: 'public',
    summary: 'Re-send a pass by email. Always 202, registered or not.',
    tags: ['Public'],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({ email: z.string().email() }) } } },
    },
    responses: {
      202: {
        description:
          'Accepted. Deliberately IDENTICAL whether or not the address is registered.',
        content: { 'application/json': { schema: z.object({ accepted: z.literal(true) }) } },
      },
      400: problemResponse('Invalid body'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const { id } = c.req.valid('param');
    const { email } = c.req.valid('json');

    // Deliberately no branch on what we find. Answering differently for a
    // registered vs unregistered address turns this endpoint into an oracle for
    // "is this person attending this event". For a church, a support group or a
    // political meeting that is a real disclosure, not a theoretical one (T39).
    //
    // NotificationService (D18) will enqueue here; the response will not change.
    await findRegistration(db, id, email);

    return c.json({ accepted: true as const }, 202);
  }
);

// ---------------------------------------------------------------------------
// scope: 'bearer' — the token in the URL IS the credential
// ---------------------------------------------------------------------------

const PassViewSchema = z
  .object({
    pass: z.object({ expiresAt: z.string(), qrValue: z.string() }),
    event: PublicEventSchema,
    person: z.object({
      firstName: z.string(),
      /** Last INITIAL only. A forwarded pass must not leak contact details. */
      lastInitial: z.string().max(1),
    }),
    attendance: z.object({ state: z.string(), checkInTime: z.string().nullable() }),
    canSelfCheckIn: z.boolean(),
  })
  .openapi('PassView');

publicRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/p/{token}',
    scope: 'bearer',
    summary: 'The pass. Reopen it anywhere, forever — no session, no account.',
    tags: ['Public'],
    request: { params: z.object({ token: z.string().min(8) }) },
    responses: {
      200: { description: 'The pass', content: { 'application/json': { schema: PassViewSchema } } },
      400: problemResponse('Not a valid pass'),
      404: problemResponse('No such pass'),
      410: problemResponse('Expired or revoked'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const { token } = c.req.valid('param');

    // A bad token on a PAGE url is 404, not 400. `/p/{token}` is something a
    // person opens; a wrong one is simply not found. Returning 400 would
    // confirm the format was right, which is a hint an attacker can use.
    // The check-in endpoints keep 400 — there the token is a submitted value.
    const verified = await Pass.verify(db, token).catch((e) => {
      if (e?.code === 'invalid_pass') throw problem.notFound(ProblemCode.NOT_FOUND, 'No such pass.');
      throw e;
    });
    const event = await loadPublicEvent(db, verified.eventId);

    const { person, attendance: state } = await passView(db, {
      eventId: verified.eventId,
      personId: verified.personId,
    });

    // Abuse signal, not access control: a pass viewed from many addresses has
    // been forwarded around.
    await Pass.recordView(db, verified.passId);

    return c.json(
      {
        // The QR encodes the same token that is in the URL — one artefact, not
        // two things that can disagree (D19).
        pass: { expiresAt: event.endAt, qrValue: token },
        event,
        person,
        attendance: state,
        canSelfCheckIn: event.allowSelfCheckIn && event.status === 'ongoing',
      },
      200
    );
  }
);

publicRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/p/{token}/check-in',
    scope: 'bearer',
    summary: 'Check yourself in from the pass',
    tags: ['Public'],
    request: { params: z.object({ token: z.string().min(8) }) },
    responses: {
      200: {
        description: 'Checked in, or already checked in',
        content: {
          'application/json': {
            schema: z.object({
              attendance: z.object({ id: z.string().uuid(), state: z.string() }),
              alreadyRecorded: z.boolean(),
            }),
          },
        },
      },
      400: problemResponse('Not a valid pass'),
      403: problemResponse('Self check-in is disabled for this event'),
      409: problemResponse('Event finished, or full'),
      410: problemResponse('Expired or revoked'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const { token } = c.req.valid('param');

    // Verified once here so a bad token never reaches the service.
    const verified = await Pass.verify(db, token);

    const result = await Attendance.checkIn(db, {
      eventId: verified.eventId,
      organizationId: verified.organizationId,
      person: { personId: verified.personId },
      method: 'self',
      isSelfService: true,
    });

    return c.json(
      {
        attendance: { id: result.attendance.id, state: result.attendance.state },
        alreadyRecorded: result.alreadyRecorded,
      },
      200
    );
  }
);
