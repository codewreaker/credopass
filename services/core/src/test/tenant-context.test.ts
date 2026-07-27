/**
 * `TenantContext` unit tests (§7.1). No database — these are about the shape of
 * authority, not about rows.
 *
 * Two describe blocks used to live here and are gone with what they guarded:
 * event grants (a per-event role map nothing ever populated) and device-token
 * scope intersection (D24 — a door is a person holding the `checkin` role now).
 */

import { describe, expect, it } from 'bun:test';
import { can, createTenantContext, type TenantContext } from '../tenancy/context';
import type { Permission } from '../authz/permissions';

const ORG = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = '22222222-2222-2222-2222-222222222222';

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

describe('the checkin role is the door (D24)', () => {
  const door = ctxFor('checkin');

  it('can do everything the kiosk needs', () => {
    expect(can(door, 'event:read')).toBe(true);
    expect(can(door, 'attendance:read')).toBe(true);
    expect(can(door, 'attendance:record')).toBe(true);
    expect(can(door, 'person:read')).toBe(true);
  });

  it('cannot touch the event it is checking people into', () => {
    // This is the claim that replaced device-token scope intersection. A door
    // credential used to be capped by an issued scope list; now the cap is the
    // role itself, which has to be at least as tight.
    expect(can(door, 'event:update')).toBe(false);
    expect(can(door, 'event:delete')).toBe(false);
    expect(can(door, 'event:cancel')).toBe(false);
    expect(can(door, 'event:create')).toBe(false);
  });

  it('cannot populate the org roll or read the member list', () => {
    // §6.2 footnote 3: a walk-in creates a person inside AttendanceService, a
    // different path from POST /people. And a door has no business enumerating
    // staff — note `viewer` can, and `checkin` deliberately cannot.
    expect(can(door, 'person:create')).toBe(false);
    expect(can(door, 'person:delete')).toBe(false);
    expect(can(door, 'member:read')).toBe(false);
    expect(can(door, 'member:invite')).toBe(false);
  });

  it('is strictly narrower than organizer', () => {
    const organizer = ctxFor('organizer');
    for (const permission of door.permissions) {
      expect(organizer.permissions.has(permission)).toBe(true);
    }
    expect(organizer.permissions.size).toBeGreaterThan(door.permissions.size);
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
      role: 'owner',
      permissions: new Set<Permission>(['org:delete']),
    };
    expect(forged.organizationId).toBe(ORG);
  });
});
