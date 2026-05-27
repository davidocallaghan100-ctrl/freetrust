-- FreeTrust Phase 2A: harden profile owner updates around verification/trust fields.
-- DO NOT APPLY without explicit production approval.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Keep public read policy as-is if present. Recreate only the unsafe insert/update policies.
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.profiles;
CREATE POLICY "Users can update own safe profile fields"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_profile_restricted_field_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  restricted_columns text[] := ARRAY[
    'is_admin',
    'is_verified',
    'verified_at',
    'verified_by',
    'verification_status',
    'verification_submitted_at',
    'verification_verified_at',
    'verification_rejected_at',
    'verification_reviewed_by',
    'verification_method',
    'verification_notes',
    'verification_session_id',
    'stripe_verification_session_id',
    'trust_tier',
    'trust_balance',
    'profile_bonus_claimed'
  ];
  column_name text;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  FOREACH column_name IN ARRAY restricted_columns LOOP
    IF (to_jsonb(OLD) ? column_name)
       AND ((to_jsonb(OLD) -> column_name) IS DISTINCT FROM (to_jsonb(NEW) -> column_name)) THEN
      RAISE EXCEPTION 'restricted_profile_field_update: % may only be changed by service role', column_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_restricted_field_updates ON public.profiles;
CREATE TRIGGER trg_prevent_profile_restricted_field_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_restricted_field_updates();

COMMENT ON FUNCTION public.prevent_profile_restricted_field_updates()
  IS 'Blocks authenticated profile owners from changing verification, trust tier, admin, or balance-related profile columns.';

NOTIFY pgrst, 'reload schema';
