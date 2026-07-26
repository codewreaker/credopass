-- ============================================================================
-- Phase -1 — Revoke direct public access to the database
-- ----------------------------------------------------------------------------
-- Reverses services/core/drizzle/rls_dev_permissive.sql, which created
--   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)
-- on all seven tables. Combined with VITE_SUPABASE_ANON_KEY shipping in the web
-- bundle (which is what an anon key is for), that made every row readable and
-- writable by anyone with the site open, bypassing the API entirely.
--
-- Verified exposed on 2026-07-26 against project zzymqzurubgparvpgfvy:
--   organizations 3 · users 34 · events 2 · org_memberships 25 · attendance 2
--   · loyalty 32 · event_members 0   — all HTTP 200 to the public key.
--
-- WHY THIS IS SAFE FOR THE API
--   The API connects as the `postgres` role. The dev policies are scoped
--   `TO anon, authenticated` and therefore never applied to `postgres` in the
--   first place — dropping them cannot change what the API can read. (RLS is
--   already enabled on every table, so if `postgres` were not bypassing RLS the
--   API would be failing today.)
--
-- WHY THIS IS SAFE FOR THE WEB APP
--   The browser Supabase client is used only for `auth.*`. There is not one
--   `.from()` or `.rpc()` call in apps/ or packages/ — all app data goes through
--   the API at /api/core. Revoking PostgREST data access breaks no code path.
--
-- Rollback: re-apply services/core/drizzle/rls_dev_permissive.sql (~30 seconds).
-- ============================================================================

BEGIN;

-- 1 · Drop the permissive dev policies -------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'organizations', 'events', 'users', 'event_members',
    'org_memberships', 'attendance', 'loyalty'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_dev_all', t);
    -- Belt and braces: RLS must stay on, with no policy => deny for these roles.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- 2 · Revoke privileges from the public-facing roles ------------------------
--
-- `authenticated` is revoked alongside `anon`, which goes further than
-- docs/API-FIRST-REBUILD.md §9.5 proposes, and deliberately so: the app offers
-- "Continue as guest" via supabase.auth.signInAnonymously()
-- (packages/lib/src/supabase/auth.ts:18), so ANY visitor can mint an
-- `authenticated` JWT with no credentials. Revoking only `anon` would leave the
-- same full read/write access one anonymous sign-in away.

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3 · Stop future tables from inheriting those grants -----------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;

-- 4 · Verify (should return zero rows) --------------------------------------
--
-- SELECT tablename, policyname, roles::text
--   FROM pg_policies
--  WHERE schemaname = 'public' AND policyname LIKE '%_dev_all';
--
-- SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');
