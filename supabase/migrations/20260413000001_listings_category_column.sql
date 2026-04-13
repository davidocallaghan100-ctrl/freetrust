-- Add text `category` column to listings + re-grant to fix PostgREST schema cache
-- ============================================================================
-- Fixes the runtime error:
--   "Could not find the 'category' column of 'listings' in the schema cache"
--
-- Root cause:
--   * app/api/listings/route.ts:113 writes to listings.category (a text slug
--     like 'technology', 'art', 'music', …) alongside category_id.
--   * The base schema (lib/supabase/schema.sql) only defines category_id as
--     a FK to the categories table — there was never a migration that added
--     the text `category` column.
--   * Someone added it out-of-band via the Supabase SQL editor, but because
--     it wasn't a proper migration, PostgREST's schema cache drifted: on
--     some deploys / pooler reconnects the column simply wasn't visible,
--     and NOTIFY pgrst 'reload schema' only hit the one PostgREST worker
--     on the current connection.
--   * Additionally, any prior column-level GRANT (…) on listings would
--     mask newly-added columns from PostgREST entirely, regardless of
--     table-level grants.
--
-- Fix:
--   1. ADD COLUMN IF NOT EXISTS category text — idempotent, leaves existing
--      rows untouched (defaults to NULL, which /api/listings already handles:
--      `category: category ?? null`).
--   2. Re-GRANT SELECT, INSERT, UPDATE at table level to `anon` and
--      `authenticated`. Table-level grants re-include ALL columns (including
--      any that were previously masked by column-level grants), which is the
--      standard fix for the "column visible in information_schema but not in
--      PostgREST schema cache" class of bug.
--   3. NOTIFY pgrst, 'reload schema' so PostgREST rebuilds its cache
--      immediately instead of waiting for the next restart.
--
-- Safe to re-run — every statement is idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'listings' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS category text;
  ELSE
    RAISE NOTICE 'skip: public.listings does not exist — category column not added';
  END IF;
END $$;

-- Re-grant at TABLE level. This is the critical step for fixing the
-- PostgREST schema cache: any previous column-level grant on listings
-- would have masked the new column, and table-level grants override
-- that masking by re-including every column.
GRANT SELECT, INSERT, UPDATE ON public.listings TO authenticated, anon;

-- Tell PostgREST to rebuild its schema cache right now. Supabase listens
-- on the 'pgrst' channel and fans the reload out to all PostgREST workers.
NOTIFY pgrst, 'reload schema';
