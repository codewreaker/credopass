-- ============================================================================
-- Layer 2 of tenancy enforcement: Row Level Security.
-- docs/API-FIRST-REBUILD.md §7.2
-- ----------------------------------------------------------------------------
-- Layer 1 is `scoped(db, ctx)` in the application. This is the independent
-- second layer: even if a service forgets its predicate, Postgres refuses the
-- row. Neither layer is allowed to be the only one.
--
-- TWO THINGS MUST BE TRUE for this to be real rather than theatre:
--
--   1. The API must not bypass it. It has to connect as `credopass_api`
--      (NOBYPASSRLS) and issue `SET LOCAL app.account_id` per transaction.
--      Until DATABASE_URL is switched to that role, these policies protect
--      direct database access only — see the note at the bottom.
--   2. `anon` must have nothing. Handled by
--      services/core/sql/001_revoke_public_data_access.sql (applied 2026-07-26).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ----------------------------------------------------------------------------
-- The role the API connects as.
--
-- NOSUPERUSER + NOBYPASSRLS is the whole point: a connection that can bypass
-- RLS makes every policy below decorative. Created NOLOGIN here; grant it a
-- password out of band and put that in DATABASE_URL at cutover.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'credopass_api') THEN
    CREATE ROLE credopass_api NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app TO credopass_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO credopass_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO credopass_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO credopass_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO credopass_api;

-- ----------------------------------------------------------------------------
-- Who is calling? Read from a transaction-local setting, never from a row the
-- caller controls.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.account_id', true), '')::uuid;
$$;

-- ----------------------------------------------------------------------------
-- Which organisations may this caller see?
--
-- SECURITY DEFINER so the lookup is not itself subject to the policy on
-- org_memberships, which would recurse. STABLE so Postgres evaluates it once
-- per statement rather than once per row — this runs inside every policy, so
-- that difference is the difference between fast and unusable.
-- ----------------------------------------------------------------------------
-- NOTE the quoted "organizationId". `org_memberships` is a legacy table with
-- camelCase identifiers, so every reference to it must be quoted — which is
-- precisely why the rebuild's new tables use snake_case (§3.2). Phase 3 renames
-- these columns and the quoting goes away.
CREATE OR REPLACE FUNCTION app.current_org_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(m."organizationId"), '{}')
  FROM org_memberships m
  WHERE m.account_id = app.current_account_id()
    AND m.status = 'active';
$$;

-- ----------------------------------------------------------------------------
-- Which `people` rows ARE this caller, across every organisation?
--
-- This is the personal scope (GET /me/tickets) — precisely what the org policy
-- is designed to prevent. Returning an array makes the policy an indexed
-- `= ANY`, not a correlated subquery evaluated per row.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.current_person_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(p.id), '{}')
  FROM people p
  WHERE p.account_id = app.current_account_id()
    AND p.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION app.current_org_ids(), app.current_person_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_account_id(), app.current_org_ids(), app.current_person_ids()
  TO credopass_api;

-- ============================================================================
-- Policies
-- ============================================================================
-- Plain tenant tables: one column comparison, no join. This is WHY `attendance`
-- keeps a denormalised organizationId — the policy runs per row.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS organizations_tenant ON public.organizations;
CREATE POLICY organizations_tenant ON public.organizations FOR ALL TO credopass_api
  USING      (id = ANY (app.current_org_ids()))
  WITH CHECK (id = ANY (app.current_org_ids()));

DROP POLICY IF EXISTS events_tenant ON public.events;
CREATE POLICY events_tenant ON public.events FOR ALL TO credopass_api
  USING      ("organizationId" = ANY (app.current_org_ids()))
  WITH CHECK ("organizationId" = ANY (app.current_org_ids()));

DROP POLICY IF EXISTS event_members_tenant ON public.event_members;
CREATE POLICY event_members_tenant ON public.event_members FOR ALL TO credopass_api
  USING (EXISTS (
    SELECT 1 FROM public.events e
     WHERE e.id = event_members."eventId"
       AND e."organizationId" = ANY (app.current_org_ids())
  ));

DROP POLICY IF EXISTS loyalty_tenant ON public.loyalty;
CREATE POLICY loyalty_tenant ON public.loyalty FOR ALL TO credopass_api
  USING      ("organizationId" = ANY (app.current_org_ids()))
  WITH CHECK ("organizationId" = ANY (app.current_org_ids()));

DROP POLICY IF EXISTS invitations_tenant ON public.invitations;
CREATE POLICY invitations_tenant ON public.invitations FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

DROP POLICY IF EXISTS org_identity_providers_tenant ON public.org_identity_providers;
CREATE POLICY org_identity_providers_tenant ON public.org_identity_providers FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

DROP POLICY IF EXISTS org_domains_tenant ON public.org_domains;
CREATE POLICY org_domains_tenant ON public.org_domains FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

-- ----------------------------------------------------------------------------
-- org_memberships — NO self predicate, deliberately.
--
-- This is the structural half of "attending an event never grants access to the
-- organisation running it" (T29, T30). Even if a service tried, the personal
-- scope has no policy path that reaches a membership row.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS org_memberships_tenant ON public.org_memberships;
CREATE POLICY org_memberships_tenant ON public.org_memberships FOR ALL TO credopass_api
  USING      ("organizationId" = ANY (app.current_org_ids()))
  WITH CHECK ("organizationId" = ANY (app.current_org_ids()));

-- ----------------------------------------------------------------------------
-- The personal scope. Getting this wrong is how you build a leak, so note the
-- asymmetry: USING carries the self-branch, WITH CHECK does NOT.
--
-- Effect: a caller may READ their own record in an organisation they have
-- nothing to do with, but can never WRITE one. An attendee cannot edit the
-- organiser's record of them (T32).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS people_access ON public.people;
CREATE POLICY people_access ON public.people FOR ALL TO credopass_api
  USING (organization_id = ANY (app.current_org_ids())
      OR account_id = app.current_account_id())
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

DROP POLICY IF EXISTS attendance_access ON public.attendance;
CREATE POLICY attendance_access ON public.attendance FOR ALL TO credopass_api
  USING ("organizationId" = ANY (app.current_org_ids())
      OR "patronId" = ANY (app.current_person_ids()))
  WITH CHECK ("organizationId" = ANY (app.current_org_ids()));

-- ----------------------------------------------------------------------------
-- Self-scoped global tables. Reached before a tenant is known, so they are
-- keyed on the account rather than an organisation. They are in the T24
-- allow-list for that reason.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS accounts_self ON public.accounts;
CREATE POLICY accounts_self ON public.accounts FOR ALL TO credopass_api
  USING      (id = app.current_account_id())
  WITH CHECK (id = app.current_account_id());

DROP POLICY IF EXISTS identities_self ON public.identities;
CREATE POLICY identities_self ON public.identities FOR ALL TO credopass_api
  USING      (account_id = app.current_account_id())
  WITH CHECK (account_id = app.current_account_id());

-- ============================================================================
-- NOT DONE YET, and it matters.
-- ----------------------------------------------------------------------------
-- The API still connects as `postgres`, which has BYPASSRLS. Everything above
-- is therefore inert on the API path until DATABASE_URL is pointed at
-- `credopass_api` and the per-transaction `SET LOCAL app.account_id` is wired
-- in. That switch is deliberately a separate, reviewable step: flipping it
-- before the tenant middleware sets the account id would make every query
-- return zero rows.
--
-- Tracked as the Phase 1 cutover task. Until then RLS guards direct database
-- access, and `scoped(db, ctx)` guards the API path.
-- ============================================================================
