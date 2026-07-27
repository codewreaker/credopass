/**
 * Kiosk device pairing. docs/API-FIRST-REBUILD.md §5.7, D9
 *
 * The flow, and why it has two halves:
 *
 *   1. An admin creates a device on the event page and gets a PAIRING CODE —
 *      eight unambiguous characters, good for fifteen minutes, single use.
 *   2. The tablet types that code into `POST /devices/pair` and receives the
 *      bearer token.
 *
 * The admin never handles the token. A long-lived credential in an admin's
 * clipboard or browser history is precisely the exposure this feature exists to
 * remove, so only the device that will use it ever sees it.
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
import { PERMISSIONS } from '../../../authz/permissions';
import * as Device from '../../../services/device';

export const deviceRoutes = new OpenAPIHono<{ Variables: CallerVars }>();

deviceRoutes.use('/events/:id/devices', requireCaller, requireTenant());
deviceRoutes.use('/organizations/:id/devices', requireCaller, requireTenant({ fromPathParam: 'id' }));

// Bound to DELETE, not mounted with `use`.
//
// `use('/devices/:deviceId', …)` matches on PATH ONLY, so it also caught
// `POST /devices/pair` with `deviceId = "pair"` — and pairing is the one device
// route that CANNOT require a token, because the tablet has no credential until
// it succeeds. The declaration said `scope: 'public'` while the mount answered
// 401, so no tablet could ever be paired. Method-bound is the fix: it cannot
// silently widen again when another verb is added to this path.
deviceRoutes.on('DELETE', '/devices/:deviceId', requireCaller, requireTenant());

const DeviceSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string(),
    eventId: z.string().uuid().nullable(),
    scopes: z.array(z.string()),
    status: z.enum(['pending', 'active', 'revoked', 'expired']),
    pairedAt: z.string().nullable(),
    lastUsedAt: z.string().nullable(),
    expiresAt: z.string(),
    /** Present only while a code is still claimable. Never the token. */
    pairingCode: z.string().nullable(),
  })
  .openapi('Device');

deviceRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/events/{id}/devices',
    scope: 'organization',
    permission: 'device:manage',
    summary: 'Pair a door tablet to this event. Returns a code, not a token.',
    tags: ['Devices'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('device:manage')] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              label: z.string().min(1).max(100),
              scopes: z.array(z.enum(PERMISSIONS)).optional(),
              expiresAt: z.string().datetime().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Read `pairingCode` to whoever is setting up the tablet.',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().uuid(),
              label: z.string(),
              eventId: z.string().uuid().nullable(),
              pairingCode: z.string(),
              pairingExpiresAt: z.string(),
              expiresAt: z.string(),
              scopes: z.array(z.string()),
            }),
          },
        },
      },
      400: problemResponse('Invalid body'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('Event not found'),
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const tenant = c.get('tenant');
    const db = await getDatabase();

    const device = await Device.createDevice(db, {
      organizationId: tenant.organizationId,
      eventId: c.req.valid('param').id,
      label: body.label,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      issuedByAccountId: tenant.accountId,
    });
    return c.json(device, 201);
  }
);

deviceRoutes.openapi(
  defineRoute({
    method: 'get',
    path: '/organizations/{id}/devices',
    scope: 'organization',
    permission: 'device:manage',
    summary: 'Every device for this organisation, and what each is doing',
    tags: ['Devices'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('device:manage')] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ eventId: z.string().uuid().optional() }),
    },
    responses: {
      200: {
        description: 'Devices',
        content: { 'application/json': { schema: z.array(DeviceSchema) } },
      },
      403: problemResponse('Insufficient role'),
      404: problemResponse('Not found, or not yours'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const devices = await Device.listDevices(
      db,
      c.get('tenant').organizationId,
      c.req.valid('query').eventId
    );
    return c.json(devices, 200);
  }
);

deviceRoutes.openapi(
  defineRoute({
    method: 'delete',
    path: '/devices/{deviceId}',
    scope: 'organization',
    permission: 'device:manage',
    summary: 'Revoke a device. Takes effect on its next request.',
    tags: ['Devices'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('device:manage')] as const,
    request: { params: z.object({ deviceId: z.string().uuid() }) },
    responses: {
      204: { description: 'Revoked' },
      403: problemResponse('Insufficient role'),
      404: problemResponse('No such active device'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    await Device.revoke(db, c.get('tenant').organizationId, c.req.valid('param').deviceId);
    return c.body(null, 204);
  }
);

/**
 * The only unauthenticated device route, and necessarily so — the tablet has no
 * credential yet.
 *
 * `scope: 'public'` rather than `'organization'`: the caller cannot be resolved
 * to a tenant, because resolving them IS what this endpoint does. Safe because
 * the code is short-lived, single-use, and grants only what the device row
 * already says.
 */
deviceRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/devices/pair',
    scope: 'public',
    summary: 'Redeem a pairing code for a device token',
    tags: ['Devices'],
    request: {
      body: {
        content: {
          'application/json': { schema: z.object({ pairingCode: z.string().min(4).max(32) }) },
        },
      },
    },
    responses: {
      200: {
        description: 'Paired. `token` is shown ONCE and cannot be retrieved again.',
        content: {
          'application/json': {
            schema: z.object({
              token: z.string(),
              deviceId: z.string().uuid(),
              label: z.string(),
              eventId: z.string().uuid().nullable(),
              organizationId: z.string().uuid(),
              scopes: z.array(z.string()),
              expiresAt: z.string(),
            }),
          },
        },
      },
      400: problemResponse('Invalid body'),
      404: problemResponse('Code unknown, already used, or expired'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const paired = await Device.pair(db, c.req.valid('json').pairingCode);
    return c.json(paired, 200);
  }
);
