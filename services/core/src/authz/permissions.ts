/**
 * The permission vocabulary and the org-role matrix.
 * docs/API-FIRST-REBUILD.md §6.1–6.3.
 *
 * Note what is absent: `event:publish`. Dropping `draft` (D2) removed it, and
 * nothing may reintroduce it without reintroducing the state machine.
 */

export const PERMISSIONS = [
  'org:read', 'org:update', 'org:delete', 'org:billing',
  'member:read', 'member:invite', 'member:update_role', 'member:remove',
  'event:read', 'event:create', 'event:update', 'event:delete', 'event:cancel',
  'series:manage',
  'person:read', 'person:create', 'person:update', 'person:delete',
  'attendance:read', 'attendance:record', 'attendance:amend',
  'analytics:read', 'analytics:export',
  'device:manage', 'media:upload', 'media:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ORG_ROLES = ['owner', 'admin', 'organizer', 'checkin', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const EVENT_ROLES = ['organizer', 'co_host', 'staff'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

/**
 * Route scopes. A route declares exactly one; `organization` additionally
 * requires a permission and the other three must not have one (§6.4).
 */
export const ROUTE_SCOPES = ['organization', 'account', 'public', 'bearer'] as const;
export type RouteScope = (typeof ROUTE_SCOPES)[number];

/**
 * §6.2. `owner ⊃ admin ⊃ organizer ⊃ checkin`; `viewer` is a separate
 * read-only branch, which is why this is written out rather than derived by
 * inheritance — viewer would inherit the wrong things.
 *
 * Two footnotes from the table are deliberately NOT encoded here because they
 * are row-dependent and cannot be decided from a role alone:
 *   ² organizer's event:update/delete/cancel/device:manage apply only to events
 *     they created or hold an `event_grants` row on — enforced in EventService.
 *   ¹ an admin may not change or remove an owner, and nobody may remove the
 *     last owner — enforced in MembershipService.
 * A permission check is necessary but not sufficient; the service still decides.
 */
const VIEWER: Permission[] = [
  'org:read', 'member:read', 'event:read', 'person:read',
  'attendance:read', 'analytics:read', 'media:read',
];

const CHECKIN: Permission[] = [
  'org:read', 'event:read', 'person:read',
  'attendance:read', 'attendance:record', 'media:read',
];

const ORGANIZER: Permission[] = [
  ...CHECKIN,
  'member:read',
  'event:create', 'event:update', 'event:delete', 'event:cancel',
  'series:manage',
  'person:create', 'person:update',
  'attendance:amend',
  'analytics:read', 'analytics:export',
  'device:manage', 'media:upload',
];

const ADMIN: Permission[] = [
  ...ORGANIZER,
  'org:update',
  'member:invite', 'member:update_role', 'member:remove',
  'person:delete',
];

const OWNER: Permission[] = [...ADMIN, 'org:delete', 'org:billing'];

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  owner: new Set(OWNER),
  admin: new Set(ADMIN),
  organizer: new Set(ORGANIZER),
  checkin: new Set(CHECKIN),
  viewer: new Set(VIEWER),
};

/**
 * §6.3 — an event grant ADDS permissions on one event. It never removes
 * org-level ones, and it never applies to a different event.
 */
export const EVENT_ROLE_PERMISSIONS: Record<EventRole, ReadonlySet<Permission>> = {
  organizer: new Set<Permission>([
    'event:update', 'event:delete', 'event:cancel', 'device:manage', 'attendance:amend',
  ]),
  co_host: new Set<Permission>(['event:update', 'attendance:amend']),
  staff: new Set<Permission>(['attendance:record', 'attendance:read', 'person:create']),
};

/**
 * `checkin` role does NOT get `person:create` (§6.2 footnote 3). A walk-in
 * check-in creates a person through AttendanceService, which is a different
 * path from `POST /people`. Granting it here would let a door tablet's
 * credential populate the org roll directly.
 */
export const isPermission = (v: string): v is Permission =>
  (PERMISSIONS as readonly string[]).includes(v);
