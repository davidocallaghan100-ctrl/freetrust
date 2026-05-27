-- Profile verification + professional experience
-- ============================================================================
-- Adds additive profile columns for a defensible person/profile verification
-- workflow and structured professional experience. Normal members can submit
-- verification details for review; only trusted/admin server-side flows should
-- grant is_verified / verified_at / verified_by.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'profiles' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS verified_at timestamptz,
      ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
      ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
      ADD COLUMN IF NOT EXISTS verification_details jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS professional_headline text,
      ADD COLUMN IF NOT EXISTS professional_experience jsonb NOT NULL DEFAULT '[]'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_profiles_is_verified
      ON public.profiles (is_verified)
      WHERE is_verified = true;

    CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
      ON public.profiles (verification_status);
  ELSE
    RAISE NOTICE 'skip: public.profiles does not exist — profile verification/professional columns not added';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
