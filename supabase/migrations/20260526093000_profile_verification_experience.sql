-- Adds conservative person/profile verification state and professional experience.
-- Users may submit a verification request; only an explicit server/admin action
-- should ever set verification_status='verified'. The public badge is keyed to
-- that approved status only, so self-submitted claims do not create a badge.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_verification_status') THEN
    CREATE TYPE public.profile_verification_status AS ENUM ('unverified', 'submitted', 'verified', 'rejected');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_status public.profile_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS verification_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS professional_experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS professional_headline text;

DO $$
DECLARE
  current_type text;
  invalid_status_count integer;
BEGIN
  SELECT c.udt_name
  INTO current_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'profiles'
    AND c.column_name = 'verification_status';

  IF current_type IS NOT NULL AND current_type <> 'profile_verification_status' THEN
    SELECT count(*)
    INTO invalid_status_count
    FROM public.profiles
    WHERE verification_status IS NOT NULL
      AND verification_status NOT IN ('unverified', 'submitted', 'verified', 'rejected');

    IF invalid_status_count > 0 THEN
      RAISE EXCEPTION 'Cannot convert profiles.verification_status to enum: % invalid values found', invalid_status_count;
    END IF;

    ALTER TABLE public.profiles
      ALTER COLUMN verification_status DROP DEFAULT,
      ALTER COLUMN verification_status TYPE public.profile_verification_status
        USING COALESCE(verification_status, 'unverified')::public.profile_verification_status,
      ALTER COLUMN verification_status SET DEFAULT 'unverified',
      ALTER COLUMN verification_status SET NOT NULL;
  END IF;
END $$;

UPDATE public.profiles
SET verification_status = 'verified',
    verification_verified_at = COALESCE(verification_verified_at, verified_at)
WHERE (is_verified = true OR verified_at IS NOT NULL)
  AND verification_status <> 'verified';

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON public.profiles (verification_status);

CREATE INDEX IF NOT EXISTS idx_profiles_is_verified
  ON public.profiles (is_verified)
  WHERE is_verified = true;

CREATE TABLE IF NOT EXISTS public.profile_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  company text,
  location text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_experiences_profile_order
  ON public.profile_experiences (profile_id, display_order, start_date DESC NULLS LAST, created_at DESC);

ALTER TABLE public.profile_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile experiences are publicly readable" ON public.profile_experiences;
CREATE POLICY "Profile experiences are publicly readable"
  ON public.profile_experiences
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users manage their own profile experiences" ON public.profile_experiences;
CREATE POLICY "Users manage their own profile experiences"
  ON public.profile_experiences
  FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE OR REPLACE FUNCTION public.set_profile_experience_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_experiences_updated_at ON public.profile_experiences;
CREATE TRIGGER trg_profile_experiences_updated_at
  BEFORE UPDATE ON public.profile_experiences
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_experience_updated_at();

COMMENT ON COLUMN public.profiles.verification_status IS 'Conservative profile verification status. Only verified displays a public badge.';
COMMENT ON COLUMN public.profiles.verification_notes IS 'User-submitted, non-sensitive context for manual review. Do not store documents or secrets here.';
COMMENT ON TABLE public.profile_experiences IS 'Professional experience entries displayed on member profiles.';

NOTIFY pgrst, 'reload schema';
