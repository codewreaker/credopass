/**
 * `TenantContext` unit tests (§7.1, §6.3). No database — these are about the
 * shape of authority, not about rows.
 */

import { describe, expect, it } from 'bun:test';
import {
  can,
  canOnEvent,
  createTenantContext,
  type TenantContext,
} from '../tenancy/context';
import type { Permission } from '../authz/permissions';

const ORG = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = '22222222-2222-2222-2222-222222222222';
const EVENT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EVENT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const ctxFor = (role: Parameters<typeof createTenantContext>[0]['role']) =>
  createTenantContext({ organizationId: ORG, accountId: ACCOUNT, role });

describe('createTenantContext', () => {
  it('derives permissions from the role, not from the caller', () => {
    expect(can(ctxFor('viewer'), 'event:read')).toBe(true);
    expect(can(ctxFor('viewer'), 'event:create')).toBe(false);
    expect(can(ctxFor('owner'), 'org:delete')).toBe(true);
  });

  it('gives a caller with no role no permissions at all', () => {
    // A brand-new account with zero memberships (T6) must not fall back to a
    // default role. Empty is the correct answer.
    const ctx = ctxFor(null);
    expect(ctx.permissions.size).toBe(0);
    expect(can(ctx, 'event:read')).toBe(false);
  });
});

describe('event grants add, never remove (§6.3)', () => {
  it('grants a permission on the named event only', () => {
    const ctx = createTenantContext({
      organizationId: ORG,
      accountId: ACCOUNT,
      role: 'viewer',
      eventGrants: new Map([[EVENT_A, 'co_host']]),
    });

    expect(canOnEvent(ctx, EVENT_A, 'event:update')).toBe(true);
    expect(canOnEvent(ctx, EVENT_B, 'event:update')).toBe(false);
    // And it does not leak into org-wide authority.
    expect(can(ctx, 'event:update')).toBe(false);
  });

  it('never removes an org-level permission', () => {
    const ctx = createTenantContext({
      organizationId: ORG,
      accountId: ACCOUNT,
      role: 'admin',
      eventGrants: new Map([[EVENT_A, 'staff']]),
    });
    // `staff` is a narrow role, but the caller is an org admin: the grant must
    // not downgrade them on that event.
    expect(canOnEvent(ctx, EVENT_A, 'event:update')).toBe(true);
  });
});

describe('device token scopes cap everything (D9, T13)', () => {
  const scopes: Permission[] = ['attendance:record', 'event:read'];

  it('intersects the role rather than granting the union', () => {
    const ctx = createTenantContext({
      organizationId: ORG,
      accountId: null,
      deviceId: 'device-1',
      role: 'organizer',
      deviceScopes: scopes,
    });

    expect(can(ctx, 'attendance:record')).toBe(true);
    expect(can(ctx, 'event:read')).toBe(true);
    // The organizer role has these; the token does not, so the token wins.
    expect(can(ctx, 'event:update')).toBe(false);
    expect(can(ctx, 'event:delete')).toBe(false);
    expect(can(ctx, 'device:manage')).toBe(false);
  });

  it('caps event-grant permissions too', () => {
    // The hole worth naming: without this, a tablet paired to an event it also
    // holds a grant on would escape its issued scopes.
    const ctx = createTenantContext({
      organizationId: ORG,
      accountId: null,
      deviceId: 'device-1',
      role: 'organizer',
      deviceScopes: scopes,
      eventGrants: new Map([[EVENT_A, 'organizer']]),
    });

    expect(canOnEvent(ctx, EVENT_A, 'event:update')).toBe(false);
    expect(canOnEvent(ctx, EVENT_A, 'device:manage')).toBe(false);
    expect(canOnEvent(ctx, EVENT_A, 'attendance:record')).toBe(true);
  });

  it('a scope list naming a permission the role lacks does not grant it', () => {
    const ctx = createTenantContext({
      organizationId: ORG,
      accountId: null,
      deviceId: 'device-1',
      role: 'checkin',
      deviceScopes: ['org:delete', 'attendance:record'],
    });
    expect(can(ctx, 'org:delete')).toBe(false);
    expect(can(ctx, 'attendance:record')).toBe(true);
  });
});

describe('the brand', () => {
  it('cannot be satisfied by a plain object literal', () => {
    // Compile-time guarantee, asserted here so the intent is recorded: the
    // line below does not typecheck without the cast, which is the whole point
    // of the brand. `@ts-expect-error` fails the build if it ever starts to.
    // @ts-expect-error — a handler must not be able to fabricate a TenantContext
    const forged: TenantContext = {
      organizationId: ORG,
      accountId: ACCOUNT,
      deviceId: null,
      role: 'owner',
      permissions: new Set<Permission>(['org:delete']),
      eventGrants: new Map(),
      deviceScopes: null,
    };
    expect(forged.organizationId).toBe(ORG);
  });
});
