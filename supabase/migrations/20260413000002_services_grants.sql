-- Re-grant public.services permissions + reload PostgREST schema cache
-- ============================================================================
-- Fixes the runtime error observed on mobile service creation:
--   "Could not find service public service in schema"
--
-- This is the same PostgREST schema-cache bug we hit on public.listings
-- (see 20260413000001_listings_category_column.sql). The symptom is that
-- PostgREST's cached schema for the `services` table is out of sync with
-- the actual table, so any insert/select that touches a new-ish column
-- is rejected before it reaches Postgres.
--
-- Root cause on listings was column-level grant masking: if at any point
-- a GRANT … (col1, col2) ON listings … was issued, PostgREST switches
-- from "all columns the role has table-level grants on" to "only the
-- columns named in information_schema.column_privileges". Any column
-- added later (e.g. the gig-rich-data columns in
-- 20260413000000_services_gig_columns.sql — packages, delivery_types,
-- tags, skills, images, service_radius) is then invisible to PostgREST
-- even though it exists in information_schema.columns.
--
-- Fix:
--   1. Re-GRANT at the TABLE level to `anon` and `authenticated`. Table-
--      level grants override column-level masking and re-include every
--      column the table currently has — including anything added by
--      later migrations.
--   2. NOTIFY pgrst 'reload schema' so PostgREST rebuilds its cache
--      immediately on all workers, instead of waiting for a restart.
--
-- Safe to re-run. The GRANT is idempotent; the NOTIFY is a no-op if no
-- PostgREST worker is listening.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'services' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    -- Table-level grants. These override any prior column-level grant
    -- that was masking newly-added columns from PostgREST's view.
    GRANT SELECT, INSERT, UPDATE ON public.services TO authenticated, anon;
  ELSE
    RAISE NOTICE 'skip: public.services does not exist — grants not applied';
  END IF;
END $$;

-- Tell PostgREST to rebuild its schema cache right now. Supabase listens
-- on the 'pgrst' channel and fans the reload out to every PostgREST worker.
NOTIFY pgrst, 'reload schema';
