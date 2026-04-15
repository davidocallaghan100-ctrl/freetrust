-- ============================================================================
-- profiles public read — re-assert + grant safety net
-- ============================================================================
-- The "Profiles are viewable by everyone" SELECT policy was first
-- added by 20260414000004_profiles_update_policy.sql to fix the
-- profile-edit-form bug. The directory audit (2026-04-15) asked for
-- a fresh idempotent migration to:
--
--   1. Re-assert the policy in case a future schema rebuild re-
--      created the profiles table without it, breaking the members
--      directory + every other public profile lookup.
--
--   2. Re-grant SELECT to anon at the table level. Without this
--      grant, even a permissive RLS policy can't bypass a missing
--      column-level grant (the same pattern that broke the listings
--      category column in 20260413000001).
--
--   3. NOTIFY pgrst so the schema cache picks up the fresh grants
--      immediately rather than waiting for the next worker restart.
--
-- Idempotent — every CREATE POLICY is wrapped in DO $$ IF NOT EXISTS,
-- and GRANT statements are no-ops when the privilege is already held.
-- Safe to re-run on any DB state.

-- ── 1. Ensure RLS is enabled on profiles ────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'profiles' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ── 2. Public SELECT policy ─────────────────────────────────────────────────
-- "Profiles are viewable by everyone" — anyone (anon or authenticated)
-- can read every row in profiles. This is what the members directory,
-- the public profile detail pages (/profile?id=…), the leaderboard,
-- and every "@mention" autocomplete depend on.
--
-- Profile rows do NOT contain any sensitive data — no email (that's
-- in auth.users), no password hash, no payment info. Everything in
-- profiles is intended to be public, hence the unconditional
-- USING (true).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone"
      ON public.profiles FOR SELECT
      USING (true);
  END IF;
END $$;

-- ── 3. Re-grant at table level so column-level masking can't bite ───────────
-- The fix pattern from 20260413000001_listings_category_column.sql:
-- a column-level GRANT on a SINGLE column on profiles (e.g. an
-- earlier migration that did `GRANT SELECT (full_name) ON profiles
-- TO anon`) silently masks every other column from the anon role,
-- so the directory query that selects 14 columns would return rows
-- with 13 nulls and only `full_name` populated. The fix is to
-- re-grant at the TABLE level which clears any prior column-level
-- masking.
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- ── 4. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
