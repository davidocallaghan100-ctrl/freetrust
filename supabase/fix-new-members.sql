-- =============================================================================
-- FreeTrust: Fix new-member visibility
-- Paste this entire script into the Supabase SQL Editor and click Run.
-- It is fully idempotent — safe to run multiple times.
-- =============================================================================

-- ── 1. Add all missing columns to profiles ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username            text UNIQUE,
  ADD COLUMN IF NOT EXISTS cover_url           text,
  ADD COLUMN IF NOT EXISTS website             text,
  ADD COLUMN IF NOT EXISTS account_type        text NOT NULL DEFAULT 'individual'
                                                 CHECK (account_type IN ('individual', 'business')),
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skills              text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interests           text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS purpose             text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS follower_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS privacy_settings    jsonb,
  ADD COLUMN IF NOT EXISTS notification_prefs  jsonb,
  ADD COLUMN IF NOT EXISTS stripe_account_id   text,
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at        timestamptz,
  ADD COLUMN IF NOT EXISTS trust_balance       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_bonus_claimed boolean NOT NULL DEFAULT false;

-- ── 2. Replace handle_new_user trigger to also capture full_name ─────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email     = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger so it picks up the new function body
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. Backfill: create profile rows for any auth users that are missing one ──
INSERT INTO public.profiles (id, email, full_name)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    NULL
  )
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. RLS — ensure public read policy exists ─────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone"
      ON public.profiles FOR SELECT USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END
$$;

-- Allow the trigger (security definer) and service role to insert profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Service role can insert profiles'
  ) THEN
    CREATE POLICY "Service role can insert profiles"
      ON public.profiles FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- ── 5. Verify ─────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM auth.users)                               AS auth_users,
  (SELECT COUNT(*) FROM public.profiles)                          AS profile_rows,
  (SELECT COUNT(*) FROM auth.users au
   WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)) AS missing_profiles;
