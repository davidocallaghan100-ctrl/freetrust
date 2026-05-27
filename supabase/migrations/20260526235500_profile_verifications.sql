-- FreeTrust Phase 2A: Stripe Identity-backed profile verification state.
-- DO NOT APPLY without explicit production approval.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_identity_verification_status') THEN
    CREATE TYPE public.profile_identity_verification_status AS ENUM ('unverified', 'pending', 'verified', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profile_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_verification_session_id text,
  status public.profile_identity_verification_status NOT NULL DEFAULT 'unverified',
  verified_at timestamptz,
  last_attempt_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  bonus_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_verifications_user_id
  ON public.profile_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_profile_verifications_stripe_session
  ON public.profile_verifications(stripe_verification_session_id)
  WHERE stripe_verification_session_id IS NOT NULL;

ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile verification" ON public.profile_verifications;
CREATE POLICY "Users can read own profile verification"
  ON public.profile_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages profile verifications" ON public.profile_verifications;
CREATE POLICY "Service role manages profile verifications"
  ON public.profile_verifications
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.set_profile_verifications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_verifications_updated_at ON public.profile_verifications;
CREATE TRIGGER trg_profile_verifications_updated_at
  BEFORE UPDATE ON public.profile_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_verifications_updated_at();

CREATE OR REPLACE FUNCTION public.grant_verification_bonus(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus_already_granted timestamptz;
BEGIN
  IF $1 IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id: user_id is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT bonus_granted_at
  INTO v_bonus_already_granted
  FROM public.profile_verifications
  WHERE profile_verifications.user_id = $1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification_not_found: %', $1 USING ERRCODE = 'P0001';
  END IF;

  IF v_bonus_already_granted IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profile_verifications
  SET bonus_granted_at = now(),
      updated_at = now()
  WHERE profile_verifications.user_id = $1
    AND bonus_granted_at IS NULL;

  PERFORM public.issue_trust(
    $1,
    100,
    'identity_verification_bonus',
    NULL,
    'Identity verification bonus'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_verification_bonus(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_verification_bonus(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.grant_verification_bonus(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_verification_bonus(uuid) TO service_role;

COMMENT ON TABLE public.profile_verifications
  IS 'Stripe Identity-backed profile verification state. Stores provider IDs/status only, not ID documents.';

COMMENT ON COLUMN public.profile_verifications.bonus_granted_at
  IS 'Idempotency guard for the one-time ₮100 identity verification bonus.';

COMMENT ON FUNCTION public.grant_verification_bonus(uuid)
  IS 'Service-role-only idempotent ₮100 TrustCoin grant for successful identity verification.';

CREATE OR REPLACE VIEW public.profile_verification_badges AS
SELECT
  user_id,
  status,
  verified_at
FROM public.profile_verifications
WHERE status = 'verified';

GRANT SELECT ON public.profile_verification_badges TO anon;
GRANT SELECT ON public.profile_verification_badges TO authenticated;

COMMENT ON VIEW public.profile_verification_badges
  IS 'Public safe profile verification badge projection. Exposes only verified status, never Stripe session IDs or identity evidence.';

NOTIFY pgrst, 'reload schema';

/*
Down migration (manual review before running):

REVOKE ALL ON FUNCTION public.grant_verification_bonus(uuid) FROM service_role;
DROP VIEW IF EXISTS public.profile_verification_badges;
DROP FUNCTION IF EXISTS public.grant_verification_bonus(uuid);
DROP TRIGGER IF EXISTS trg_profile_verifications_updated_at ON public.profile_verifications;
DROP FUNCTION IF EXISTS public.set_profile_verifications_updated_at();
DROP POLICY IF EXISTS "Service role manages profile verifications" ON public.profile_verifications;
DROP POLICY IF EXISTS "Users can read own profile verification" ON public.profile_verifications;
DROP TABLE IF EXISTS public.profile_verifications;
DROP TYPE IF EXISTS public.profile_identity_verification_status;
*/
