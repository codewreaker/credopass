/**
 * The account scope: /me and /me/context.
 * docs/API-FIRST-REBUILD.md §5.1
 *
 * These are `scope: 'account'` — self-scoped. They take no X-Organization-Id,
 * they never consult a tenant, and they read only rows belonging to the caller.
 * That is why they declare no permission: there is no org whose role could
 * grant or withhold access to your own record.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { defineRoute, problemResponse } from '../../../http/define-route';
import { requireCaller, type CallerVars } from '../../../middleware/caller';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../../authz/permissions';
import { getDatabase } from '../../../db/client';
import { publicAppUrl } from '../../../config/public-url';
import { claimByVerifiedEmail, updateAccountDisplayName } from '../../../services/identity';
import * as Tickets from '../../../services/tickets';
import { EVENT_STATUSES } from '../../../services/event-status';
import { EVENT_FORMATS } from '../../../services/event-format';

export const me = new OpenAPIHono<{ Variables: CallerVars }>();

// Scoped to these paths, NOT '*'. This sub-app is mounted at the root so its
// paths read as /me and /me/context, which means a wildcard here would put auth
// on /health, /docs and /openapi.json too — and a health probe that returns 401
// takes the service out of the load balancer. Two matchers because Hono's
// '/me/*' does not match '/me' itself.
me.use('/me', requireCaller);
me.use('/me/*', requireCaller);

const AccountSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().nullable(),
    displayName: z.string().nullable(),
  })
  .openapi('Account');

const OrgSummarySchema = z
  .object({
    id: z.string().uuid(),
    // The name ships with the bootstrap context so no screen has to fetch
    // /organizations a second time just to label the active org. The composer's
    // "No organization" was that second request losing a race (B2).
    name: z.string(),
    role: z.string(),
  })
  .openapi('OrgSummary');

const MeContextSchema = z
  .object({
    account: AccountSchema,
    organizations: z.array(OrgSummarySchema),
    activeOrganization: z.union([OrgSummarySchema, z.null()]),
    membership: z
      // `z.enum(PERMISSIONS)`, not `z.string()`. This array is where the
      // permission vocabulary reaches the OpenAPI document, and therefore the
      // generated client's `Permission` union — the client used to read it off
      // the device-pairing request body, which disappeared with device tokens.
      // Naming the enum here is also simply more honest: the field ships a
      // closed set, so the contract should say so.
      .object({ role: z.string(), permissions: z.array(z.enum(PERMISSIONS)) })
      .nullable(),
  })
  .openapi('MeContext');

me.openapi(
  defineRoute({
    method: 'get',
    path: '/me',
    scope: 'account',
    summary: 'The signed-in account',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'The caller', content: { 'application/json': { schema: AccountSchema } } },
      401: problemResponse('No valid token'),
    },
  }),
  (c) => {
    const caller = c.get('caller');
    return c.json(
      {
        id: caller.accountId,
        email: caller.email,
        displayName: caller.displayName,
      },
      200
    );
  }
);

/**
 * The first call every screen makes.
 *
 * `organizations` lists the caller's MEMBERSHIPS and nothing else — which is
 * the fix for the leak where OrgSelector listed every organisation in the
 * database and auto-selected the first (T1, §10.7).
 *
 * There is no `needsOnboarding`. It used to say "this caller belongs to nothing,
 * send them to the onboarding wizard", but `ensureDefaultOrganization` gives
 * every account an organisation on its first authenticated request, so the field
 * was permanently false and the wizard permanently unreachable. Onboarding is
 * signing in (D22).
 */
me.openapi(
  defineRoute({
    method: 'get',
    path: '/me/context',
    scope: 'account',
    summary: 'Account, memberships, active org and effective permissions',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    request: {
      headers: z.object({
        'x-organization-id': z.string().uuid().optional(),
      }),
    },
    responses: {
      200: { description: 'Bootstrap context', content: { 'application/json': { schema: MeContextSchema } } },
      401: problemResponse('No valid token'),
    },
  }),
  (c) => {
    const caller = c.get('caller');
    const organizations = caller.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    }));

    const requested = c.req.header('X-Organization-Id');
    const active =
      organizations.find((o) => o.id === requested) ??
      (organizations.length === 1 ? organizations[0] : null);

    // Permissions are decided here, server-side, and shipped to the client as a
    // flat list. The client renders from them; it never derives them (rule 5).
    const permissions = active
      ? [...ROLE_PERMISSIONS[caller.memberships.find((m) => m.organizationId === active.id)!.role]]
      : [];

    return c.json({
      account: {
        id: caller.accountId,
        email: caller.email,
        displayName: caller.displayName,
      },
      organizations,
      activeOrganization: active,
      membership: active ? { role: active.role, permissions } : null,
    }, 200);
  }
);

/**
 * Edit your own account.
 *
 * The Profile tab said "Read-only for now — editing your profile isn't built
 * yet" because this did not exist (U4). It is `scope: 'account'` and declares
 * no permission for the same reason `GET /me` does not: the row is the
 * caller's, and no organisation role could grant or withhold it.
 *
 * `displayName` is the whole of it on purpose. Email is NOT editable here and
 * must not become so: an account is `(issuer, subject)` and `accounts.email` is
 * a MIRROR of what the provider asserted (D1). Letting someone type a different
 * address into it would make the mirror lie, and `uq_accounts_email` would then
 * reject or steal addresses depending on who got there first.
 *
 * Sending `null` clears the name, which puts the greeting back on the email
 * local part — a legitimate thing to want, and the reason the field is
 * nullable rather than required.
 */
me.openapi(
  defineRoute({
    method: 'patch',
    path: '/me',
    scope: 'account',
    summary: 'Update your own account',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z
              .object({
                displayName: z.union([z.string().trim().min(1).max(120), z.null()]),
              })
              .partial()
              .openapi('UpdateMeBody'),
          },
        },
      },
    },
    responses: {
      200: { description: 'The updated account', content: { 'application/json': { schema: AccountSchema } } },
      400: problemResponse('Validation failed'),
      401: problemResponse('No valid token'),
    },
  }),
  async (c) => {
    const caller = c.get('caller');
    const body = c.req.valid('json');

    // An empty PATCH is a no-op, not an error: it is what a form submits when
    // nothing changed.
    if (body.displayName === undefined) {
      return c.json(
        { id: caller.accountId, email: caller.email, displayName: caller.displayName },
        200
      );
    }

    const db = await getDatabase();
    const updated = await updateAccountDisplayName(db, caller.accountId, body.displayName);

    return c.json(
      { id: updated.id, email: updated.email, displayName: updated.displayName },
      200
    );
  }
);

// ---------------------------------------------------------------------------
// The personal scope: my tickets. docs/API-FIRST-REBUILD.md D17, D26
//
// These are `scope: 'account'` for the same reason /me is, and the reason is
// worth being explicit about because the rows they return belong to OTHER
// organisations. They are reachable not because the caller has a role anywhere
// — they may have none — but because `people.account_id` says those attendee
// rows are the caller's own. Attending is not belonging (T29): nothing here
// reads or writes `org_memberships`, and nothing here takes an
// X-Organization-Id.
// ---------------------------------------------------------------------------

const TicketSchema = z
  .object({
    eventId: z.string().uuid(),
    name: z.string(),
    status: z.enum(EVENT_STATUSES),
    startAt: z.string(),
    endAt: z.string(),
    timezone: z.string(),
    location: z.union([z.string(), z.null()]),
    meetingUrl: z.union([z.string(), z.null()]),
    format: z.enum(EVENT_FORMATS),
    coverImageUrl: z.union([z.string(), z.null()]),
    organizationName: z.string(),
    attendanceState: z.enum(Tickets.ATTENDANCE_STATES),
    registeredAt: z.union([z.string(), z.null()]),
    checkInTime: z.union([z.string(), z.null()]),
  })
  .openapi('Ticket');

me.openapi(
  defineRoute({
    method: 'get',
    path: '/me/tickets',
    scope: 'account',
    summary: 'Events you are attending, across every organisation',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        group: z.enum(Tickets.TICKET_GROUPS).default('upcoming'),
      }),
    },
    responses: {
      200: {
        description: 'Your tickets, soonest first for upcoming and most recent first for past',
        content: {
          'application/json': {
            schema: z.object({
              tickets: z.array(TicketSchema),
              counts: z.object({ upcoming: z.number().int(), past: z.number().int() }),
            }),
          },
        },
      },
      401: problemResponse('No valid token'),
    },
  }),
  async (c) => {
    const caller = c.get('caller');
    const { group } = c.req.valid('query');
    const db = await getDatabase();

    // Both halves every time. The switch shows a count for the side you are
    // not on, and a screen that renders `0` while it waits for a second
    // request is the most repeated defect in this product (UI-REDESIGN R2).
    const [tickets, counts] = await Promise.all([
      Tickets.listTickets(db, caller.accountId, group),
      Tickets.ticketCounts(db, caller.accountId),
    ]);

    return c.json({ tickets, counts }, 200);
  }
);

/**
 * Put a pass back in the caller's hands.
 *
 * It MINTS a new one rather than returning the old: only the SHA-256 of a
 * token is stored, so the link handed over at registration really is the only
 * copy. Minting revokes the previous pass — `uq_passes_event_person_live`
 * allows exactly one live pass per person per event, and the pass screen has
 * always said as much.
 */
me.openapi(
  defineRoute({
    method: 'post',
    path: '/me/tickets/{eventId}/pass',
    scope: 'account',
    summary: 'Reissue your own pass for an event you are attending',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ eventId: z.string().uuid() }) },
    responses: {
      201: {
        description: 'A fresh pass. The previous one is now revoked.',
        content: {
          'application/json': {
            schema: z.object({
              pass: z.object({
                url: z.string(),
                token: z.string(),
                expiresAt: z.string(),
              }),
            }),
          },
        },
      },
      401: problemResponse('No valid token'),
      404: problemResponse('You have no ticket for that event'),
    },
  }),
  async (c) => {
    const caller = c.get('caller');
    const { eventId } = c.req.valid('param');
    const pass = await Tickets.reissuePass(
      await getDatabase(),
      caller.accountId,
      eventId,
      publicAppUrl()
    );
    return c.json({ pass }, 201);
  }
);

/**
 * Claim registrations made before this account existed (D17, T33/T34).
 *
 * Someone registers for three events as a guest over a year, then signs in for
 * the first time. Those three `people` rows have no `account_id`, so
 * `/me/tickets` is empty and the product looks like it lost them. This links
 * them.
 *
 * **Matching is on an address the ISSUER asserted, never one the caller typed.**
 * `claimByVerifiedEmail` reads `identities.email_verified`, which until now was
 * permanently false — Supabase sends no top-level `email_verified` claim, so
 * the obvious read of it never fired and this endpoint would have claimed
 * nothing. `emailVerifiedFromClaims` derives it from the provider recorded in
 * `app_metadata` instead, which GoTrue writes and the caller cannot.
 *
 * It creates NO membership. Claiming a ticket is not joining an organisation
 * (T34), and the response deliberately says only how many rows moved and how
 * many organisations they spanned — never which ones, or whose.
 *
 * Idempotent: a second call claims nothing and returns zeros.
 */
me.openapi(
  defineRoute({
    method: 'post',
    path: '/me/claim',
    scope: 'account',
    summary: 'Link earlier guest registrations to this account',
    tags: ['Identity'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'How much was linked',
        content: {
          'application/json': {
            schema: z
              .object({
                claimed: z.number().int(),
                organizations: z.number().int(),
              })
              .openapi('ClaimResult'),
          },
        },
      },
      401: problemResponse('No valid token'),
    },
  }),
  async (c) => {
    const caller = c.get('caller');
    const result = await claimByVerifiedEmail(await getDatabase(), caller.accountId);
    return c.json(result, 200);
  }
);
