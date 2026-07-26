-- ============================================================================
-- DEV-ONLY permissive RLS policies
-- ----------------------------------------------------------------------------
-- The client now talks to Supabase (PostgREST) directly with the public anon
-- key. Every table has RLS enabled (drizzle `.enableRLS()`) but no policies, so
-- PostgREST returns [] for every request. These policies open full read/write
-- to the anon and authenticated roles so data is visible again.
--
-- WARNING: `USING (true)` means anyone holding the (public) anon key can read
-- and write every row. This is acceptable for development/demo ONLY. Replace
-- with org-membership-scoped policies before production. See
-- 03-tanstack-db-supabase-plan-revised.md (phase 0 prerequisite).
-- ============================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'organizations',
    'events',
    'users',
    'event_members',
    'org_memberships',
    'attendance',
    'loyalty'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_dev_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t || '_dev_all', t
    );
  END LOOP;
END $$;
