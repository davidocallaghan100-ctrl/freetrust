-- ============================================================================
-- Defensive: ensure the "Users can update own profile" RLS policy exists
-- ============================================================================
-- The profile edit button on /profile was failing silently in production.
-- Root cause investigation:
--
--   * components/profile/ProfilePage.tsx handleSave calls
--       supabase.from('profiles').update({...}).eq('id', user.id)
--     with the regular (anon-key) client, so RLS applies.
--   * lib/supabase/schema.sql:87 defines the UPDATE policy:
--       create policy "Users can update own profile" on profiles
--       for update using (auth.uid() = id);
--   * supabase/fix-new-members.sql:101 also creates it.
--   * BUT neither of those is a versioned migration — the first is the
--     base schema file (may or may not have been applied as-is in
--     production), the second is a one-off helper script outside the
--     supabase/migrations/ directory (may or may not have been run).
--
-- If the policy is missing, PostgREST silently returns 0 rows updated
-- with error: null. The old handleSave then thought the save had
-- succeeded and set editing=false, which looked to the user like
-- "clicking Edit does nothing" on re-open. The companion commit fixes
-- the silent catch in handleSave by chaining .select() and detecting
-- 0-rows-updated, but that only surfaces the symptom — this migration
-- fixes the root cause by guaranteeing the policy exists.
--
-- Idempotent: CREATE POLICY wrapped in DO $$ IF NOT EXISTS, GRANTs are
-- always safe to re-run, NOTIFY is a no-op if nothing changed.

-- ── 1. Ensure RLS is enabled on profiles ────────────────────────────────────
-- No-op if it's already on; cheap sanity check otherwise.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 2. UPDATE policy — own row only ─────────────────────────────────────────
-- USING (auth.uid() = id)      — which rows you can target for UPDATE
-- WITH CHECK (auth.uid() = id) — what the new row must look like after
--                                the UPDATE. Without WITH CHECK, a user
--                                could theoretically pass the USING
--                                filter and then update their id to
--                                someone else's — shouldn't matter
--                                because id is the primary key and
--                                unchangeable, but belt-and-braces.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ── 3. SELECT policy — defense in depth ─────────────────────────────────────
-- Not strictly required for this bug, but if SELECT is also missing the
-- user can't even LOAD their own profile, which would produce the same
-- "edit button broken" symptom from a different angle. This policy
-- already exists in schema.sql but, like the UPDATE policy, isn't in a
-- versioned migration — fix both while we're here.
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

-- ── 4. Re-grant at table level ──────────────────────────────────────────────
-- Same fix pattern as 20260413000001_listings_category_column.sql —
-- any prior column-level grant on profiles would mask the columns the
-- client UPDATE sends (full_name, bio, location, website), so we
-- re-grant at the TABLE level to re-include every column.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- ── 5. Force PostgREST to rebuild its schema cache ──────────────────────────
-- So the policy change takes effect immediately instead of waiting for
-- the next worker restart.
NOTIFY pgrst, 'reload schema';
