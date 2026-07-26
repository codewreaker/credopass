-- ============================================================================
-- Row Level Security — layer 2 of tenancy enforcement.
-- docs/API-FIRST-REBUILD.md §7.2
-- ----------------------------------------------------------------------------
-- Layer 1 is `scoped(db, ctx)` in the application. This is the independent
-- second layer: even if a service forgets its predicate, Postgres refuses the
-- row. Neither layer is permitted to be the only one.
--
-- Every identifier here is snake_case and unquoted, which is exactly why the
-- schema was rewritten that way — the old quoted "camelCase" columns made every
-- policy a quoting exercise.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ----------------------------------------------------------------------------
-- The role the API connects as.
--
-- NOSUPERUSER + NOBYPASSRLS is the whole point: a connection that can bypass
-- RLS makes every policy below decorative.
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

-- Nothing for the public roles, ever. This is the permanent form of the
-- Phase -1 fix: the database is not directly reachable from a browser.
--
-- Guarded because `anon` and `authenticated` are Supabase's roles — a plain
-- Postgres container (local dev, CI, Testcontainers) has neither, and an
-- unconditional REVOKE fails the whole migration there.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Who is calling? From a transaction-local setting, never from a row the caller
-- controls.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.account_id', true), '')::uuid;
$$;

-- SECURITY DEFINER so the lookup is not itself subject to the policy on
-- org_memberships, which would recurse. STABLE so Postgres evaluates it once
-- per statement rather than once per row — this runs inside every policy.
CREATE OR REPLACE FUNCTION app.current_org_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(m.organization_id), '{}')
  FROM org_memberships m
  WHERE m.account_id = app.current_account_id()
    AND m.status = 'active';
$$;

-- The personal scope (GET /me/tickets) — precisely what the org policy is
-- designed to prevent. An array makes the policy an indexed `= ANY`, not a
-- correlated subquery evaluated per row.
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
GRANT EXECUTE ON FUNCTION
  app.current_account_id(), app.current_org_ids(), app.current_person_ids()
  TO credopass_api;

-- ============================================================================
-- Tenant tables — one column comparison, no join.
-- ============================================================================

CREATE POLICY organizations_tenant ON public.organizations FOR ALL TO credopass_api
  USING      (id = ANY (app.current_org_ids()))
  WITH CHECK (id = ANY (app.current_org_ids()));

CREATE POLICY events_tenant ON public.events FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

CREATE POLICY event_grants_tenant ON public.event_grants FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

CREATE POLICY invitations_tenant ON public.invitations FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

CREATE POLICY org_identity_providers_tenant ON public.org_identity_providers FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

CREATE POLICY org_domains_tenant ON public.org_domains FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

-- org_memberships gets NO self predicate, deliberately. This is the structural
-- half of "attending an event never grants access to the organisation running
-- it" (T29, T30): the personal scope has no policy path that reaches a
-- membership row.
CREATE POLICY org_memberships_tenant ON public.org_memberships FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

-- passes gets no self predicate either. A pass is reached by presenting its
-- token, which the API resolves before opening a tenant transaction. A
-- self-branch would let a signed-in account enumerate its own pass tokens —
-- a capability nothing needs (T40).
CREATE POLICY passes_tenant ON public.passes FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

-- ============================================================================
-- The personal scope. Note the asymmetry — it is the whole design.
--
-- USING carries the self-branch; WITH CHECK does NOT. So a caller may READ
-- their own record in an organisation they have nothing to do with, and can
-- never WRITE one. An attendee cannot edit the organiser's record of them (T32).
-- ============================================================================

CREATE POLICY people_access ON public.people FOR ALL TO credopass_api
  USING (organization_id = ANY (app.current_org_ids())
      OR account_id = app.current_account_id())
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

CREATE POLICY attendance_access ON public.attendance FOR ALL TO credopass_api
  USING (organization_id = ANY (app.current_org_ids())
      OR person_id = ANY (app.current_person_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));

-- ============================================================================
-- Self-scoped globals. Reached before a tenant is known, so keyed on the
-- account. These are the T24 allow-list.
-- ============================================================================

CREATE POLICY accounts_self ON public.accounts FOR ALL TO credopass_api
  USING      (id = app.current_account_id())
  WITH CHECK (id = app.current_account_id());

CREATE POLICY identities_self ON public.identities FOR ALL TO credopass_api
  USING      (account_id = app.current_account_id())
  WITH CHECK (account_id = app.current_account_id());
