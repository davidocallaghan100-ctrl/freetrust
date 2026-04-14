-- Add hobbies text[] column to profiles
-- ============================================================================
-- Powers the onboarding hobbies step and the profile page hobbies section
-- added in the "feat: mandatory first/last name + hobbies on onboarding
-- and profile" commit.
--
-- Shape: text[] — same pattern used for skills, interests, and purpose
-- on profiles (all added by 20260410_profiles_extended_columns.sql). The
-- onboarding API encodes the array via toPgTagArray() from
-- lib/supabase/text-array.ts to sidestep PostgREST's JSON → text[] "The
-- string did not match the expected pattern" coercion bug that has bitten
-- listings, services, and grassroots in prior migrations.
--
-- Permissions:
--   Re-GRANT SELECT, UPDATE at the TABLE level to authenticated. This
--   re-includes any column previously masked by a column-level GRANT
--   from PostgREST's schema cache — the same fix pattern documented in
--   20260413000001_listings_category_column.sql.
--
-- NOTIFY pgrst 'reload schema' forces PostgREST to rebuild its cache
-- immediately instead of waiting for the next restart.
--
-- Safe to re-run — every statement is idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'profiles' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS hobbies text[];
  ELSE
    RAISE NOTICE 'skip: public.profiles does not exist — hobbies column not added';
  END IF;
END $$;

-- Re-grant at TABLE level so PostgREST's schema cache sees the new
-- column. Without this, newly-added columns are sometimes masked by
-- earlier column-level grants and become invisible to the REST API.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Tell PostgREST to rebuild its schema cache right now. Supabase
-- listens on the 'pgrst' channel and fans the reload out to all
-- PostgREST workers.
NOTIFY pgrst, 'reload schema';
