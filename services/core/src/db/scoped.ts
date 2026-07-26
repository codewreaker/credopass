/**
 * The tenant-scoped repository layer. docs/API-FIRST-REBUILD.md §7.1.
 *
 * Every tenant-scoped table is reachable ONLY through this function, and this
 * function takes a `TenantContext` it cannot fabricate. That makes "the tenant
 * comes from the token, never the payload" a property of the type system rather
 * than a convention someone has to remember.
 *
 * Layer 1 of two. RLS (§7.2) re-checks the same predicate independently inside
 * Postgres, so a bug here does not become a leak on its own.
 *
 * Unused in Phase 0 by design — it lands with the tables it will guard, and
 * Phase 1 rewires the routes onto it. The tables below are the CURRENT schema;
 * Phase 1 replaces `users` with `accounts` + `people` and adds the rest.
 */

import { and, eq, isNull, type SQL } from 'drizzle-orm';
import {
  attendance,
  events,
  eventMembers,
  loyalty,
  orgMemberships,
  organizations,
} from '@credopass/lib/schemas/tables';
import type { TenantContext } from '../tenancy/context';
import type { Database } from './client';

/**
 * Tables carrying their own `organizationId`. `attendance` keeps it
 * denormalised deliberately — it turns each RLS policy into a single column
 * comparison instead of a join, which matters when the policy runs per row.
 */
const ORG_SCOPED = {
  events,
  attendance,
  orgMemberships,
  loyalty,
} as const;

export type ScopedTable = keyof typeof ORG_SCOPED;

/**
 * Build the tenant predicate for a table. Exported so services can compose it
 * into larger queries without hand-writing `eq(x.organizationId, ...)` — which
 * is the line that gets forgotten.
 */
export function tenantWhere(ctx: TenantContext, table: ScopedTable): SQL {
  return eq(ORG_SCOPED[table].organizationId, ctx.organizationId);
}

/**
 * The scoped accessor. Each method returns a query already constrained to the
 * caller's organization; there is no way to obtain an unconstrained one from
 * here.
 */
export function scoped(db: Database, ctx: TenantContext) {
  return {
    events: () =>
      db.select().from(events).where(
        and(eq(events.organizationId, ctx.organizationId), isNull(events.deletedAt))
      ),

    attendance: () =>
      db.select().from(attendance).where(eq(attendance.organizationId, ctx.organizationId)),

    orgMemberships: () =>
      db.select().from(orgMemberships).where(eq(orgMemberships.organizationId, ctx.organizationId)),

    loyalty: () =>
      db.select().from(loyalty).where(eq(loyalty.organizationId, ctx.organizationId)),

    /**
     * The organization itself — by id, so the caller can only ever read the one
     * they are scoped to.
     */
    organization: () =>
      db.select().from(organizations).where(eq(organizations.id, ctx.organizationId)),

    /**
     * `event_members` has no `organizationId` column today, so it is scoped
     * through its event. Phase 1 replaces it with `event_grants`, which carries
     * a denormalised `organization_id` precisely so this join goes away (§3.2).
     */
    eventMembers: () =>
      db
        .select()
        .from(eventMembers)
        .innerJoin(events, eq(eventMembers.eventId, events.id))
        .where(eq(events.organizationId, ctx.organizationId)),
  };
}

export type ScopedDb = ReturnType<typeof scoped>;
