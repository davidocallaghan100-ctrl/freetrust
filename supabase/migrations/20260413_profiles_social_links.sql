-- Profiles → social link columns
-- ============================================================================
-- Adds 7 nullable text columns to profiles so members can showcase their
-- LinkedIn / Instagram / Twitter / GitHub / TikTok / YouTube / personal
-- website on their public profile, listing cards, and the member directory.
--
-- All columns are plain text (no CHECK constraint on URL format) — the
-- frontend validates with a lightweight URL regex before save, and we
-- intentionally don't enforce it at the DB level so future format changes
-- (e.g. linkedin.cn, custom domains) don't require a schema migration.
--
-- Safe to re-run: every statement uses ADD COLUMN IF NOT EXISTS, wrapped
-- in a DO $$ block that first checks the table exists. Same defensive
-- pattern as 20260412_marketplace_location.sql so a half-set-up project
-- doesn't abort the whole script at the first missing reference.
--
-- Note on `website_url`: the profiles table already has a `website` column
-- (added in 20260410_profiles_extended_columns.sql). We add `website_url`
-- as a separate field anyway because the spec asks for the explicit name
-- and we don't want to silently break existing queries that read the
-- legacy `website` column. The settings page writes both columns to keep
-- them in sync going forward.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'profiles' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS linkedin_url  text,
      ADD COLUMN IF NOT EXISTS instagram_url text,
      ADD COLUMN IF NOT EXISTS twitter_url   text,
      ADD COLUMN IF NOT EXISTS github_url    text,
      ADD COLUMN IF NOT EXISTS tiktok_url    text,
      ADD COLUMN IF NOT EXISTS youtube_url   text,
      ADD COLUMN IF NOT EXISTS website_url   text;
  ELSE
    RAISE NOTICE 'skip: public.profiles does not exist — social link columns not added';
  END IF;
END $$;
