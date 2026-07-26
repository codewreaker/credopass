/**
 * The tenant-scoped repository layer. docs/API-FIRST-REBUILD.md §7.1
 *
 * Every tenant-scoped table is reachable ONLY through this function, and this
 * function takes a `TenantContext` it cannot fabricate. That makes "the tenant
 * comes from the token, never the payload" a property of the type system rather
 * than a convention someone has to remember.
 *
 * Layer 1 of two. RLS (§7.2) re-checks the same predicate independently inside
 * Postgres, so a bug here does not become a leak on its own.
 */

import { and, eq, isNull, type SQL } from 'drizzle-orm';
import {
  attendance,
  eventGrants,
  events,
  invitations,
  orgDomains,
  orgIdentityProviders,
  orgMemberships,
  organizations,
  passes,
  people,
} from '@credopass/lib/schemas/tables';
import type { TenantContext } from '../tenancy/context';
import type { Database } from './client';

/**
 * Tables carrying their own `organization_id`.
 *
 * `attendance`, `event_grants` and `passes` keep it denormalised deliberately:
 * it turns each RLS policy into a single column comparison instead of a join,
 * which matters when the policy runs per row.
 */
const ORG_SCOPED = {
  events,
  attendance,
  people,
  passes,
  eventGrants,
  invitations,
  orgMemberships,
  orgIdentityProviders,
  orgDomains,
} as const;

export type ScopedTable = keyof typeof ORG_SCOPED;

/**
 * The tenant predicate for a table. Exported so services can compose it into
 * larger queries without hand-writing `eq(x.organizationId, …)` — which is the
 * line that gets forgotten.
 */
export function tenantWhere(ctx: TenantContext, table: ScopedTable): SQL {
  return eq(ORG_SCOPED[table].organizationId, ctx.organizationId);
}

/**
 * The scoped accessor. Each method returns a query already constrained to the
 * caller's organisation; there is no way to obtain an unconstrained one here.
 */
export function scoped(db: Database, ctx: TenantContext) {
  const org = ctx.organizationId;

  return {
    events: () =>
      db.select().from(events).where(and(eq(events.organizationId, org), isNull(events.deletedAt))),

    people: () =>
      db.select().from(people).where(and(eq(people.organizationId, org), isNull(people.deletedAt))),

    attendance: () =>
      db.select().from(attendance).where(eq(attendance.organizationId, org)),

    passes: () => db.select().from(passes).where(eq(passes.organizationId, org)),

    eventGrants: () => db.select().from(eventGrants).where(eq(eventGrants.organizationId, org)),

    invitations: () => db.select().from(invitations).where(eq(invitations.organizationId, org)),

    members: () => db.select().from(orgMemberships).where(eq(orgMemberships.organizationId, org)),

    identityProviders: () =>
      db.select().from(orgIdentityProviders).where(eq(orgIdentityProviders.organizationId, org)),

    domains: () => db.select().from(orgDomains).where(eq(orgDomains.organizationId, org)),

    /** The organisation itself — by id, so only the one in scope. */
    organization: () => db.select().from(organizations).where(eq(organizations.id, org)),
  };
}

export type ScopedDb = ReturnType<typeof scoped>;
