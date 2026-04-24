-- ============================================================================
-- Migration: 20260424000003_profile_bonus_trigger.sql
--
-- Problem:  The profile completion bonus (₮10) is only awarded when the
--           frontend explicitly calls POST /api/profile/complete-bonus.
--           This endpoint is NOT called during onboarding completion —
--           /api/onboarding sets onboarding_complete = true but never
--           triggers the bonus check. Result: any user who completes
--           onboarding with a fully-filled profile gets onboarding_complete
--           = true, but profile_bonus_claimed stays false and ₮10 is never
--           issued unless they separately trigger the endpoint.
--
-- Fix:      Add a Postgres AFTER UPDATE trigger on public.profiles that fires
--           when onboarding_complete transitions from false → true. If all 7
--           required profile fields are non-null/non-empty AND
--           profile_bonus_claimed is still false, the trigger automatically:
--             1. Calls public.issue_trust() to award ₮10
--             2. Sets profile_bonus_claimed = true
--
--           This makes the bonus award automatic and independent of which
--           frontend path the user took, so it fires for:
--             - Users who complete onboarding (the primary path)
--             - Users who fill in their profile via settings and then happen
--               to have onboarding_complete flip to true
--
--           The idempotency guard (profile_bonus_claimed check) ensures the
--           trigger never double-awards even if onboarding_complete is set
--           multiple times.
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ── 1. Trigger function ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_profile_complete_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when onboarding_complete transitions false → true
  IF (OLD.onboarding_complete IS DISTINCT FROM true) AND (NEW.onboarding_complete = true) THEN

    -- Idempotency guard: skip if already claimed
    IF NEW.profile_bonus_claimed = true THEN
      RETURN NEW;
    END IF;

    -- Check all 7 required fields are non-null and non-empty
    IF (
      NEW.full_name  IS NOT NULL AND NEW.full_name  <> '' AND
      NEW.bio        IS NOT NULL AND NEW.bio        <> '' AND
      NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> '' AND
      NEW.cover_url  IS NOT NULL AND NEW.cover_url  <> '' AND
      NEW.location   IS NOT NULL AND NEW.location   <> '' AND
      NEW.website    IS NOT NULL AND NEW.website    <> '' AND
      NEW.username   IS NOT NULL AND NEW.username   <> ''
    ) THEN
      -- Award ₮10 via issue_trust RPC
      -- issue_trust signature: (p_user_id, p_amount, p_type, p_ref, p_desc)
      PERFORM public.issue_trust(
        NEW.id,
        10,
        'profile_complete',
        NULL,
        'Profile 100% complete bonus (auto-awarded on onboarding completion)'
      );

      -- Set the claimed flag so the endpoint and this trigger are both idempotent
      -- We use NEW.xxx = ... here; the trigger is BEFORE-compatible but we're
      -- AFTER so we need a direct UPDATE. Because we're SECURITY DEFINER this
      -- bypasses RLS safely.
      UPDATE public.profiles
         SET profile_bonus_claimed = true
       WHERE id = NEW.id
         AND profile_bonus_claimed = false;  -- extra guard

      RAISE LOG '[profile_bonus_trigger] Awarded ₮10 to user % (onboarding complete)', NEW.id;
    ELSE
      -- Profile isn't fully complete yet — log but don't award
      RAISE LOG '[profile_bonus_trigger] User % completed onboarding but profile is incomplete — skipping bonus', NEW.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Attach the trigger to profiles ───────────────────────────────────────
-- Drop and recreate so re-runs are idempotent.
DROP TRIGGER IF EXISTS on_onboarding_complete ON public.profiles;

CREATE TRIGGER on_onboarding_complete
  AFTER UPDATE OF onboarding_complete ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.award_profile_complete_bonus();

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_trigger_ok  boolean;
  v_function_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_class   c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname  = 'public'
       AND c.relname  = 'profiles'
       AND t.tgname   = 'on_onboarding_complete'
       AND NOT t.tgisinternal
  ) INTO v_trigger_ok;

  SELECT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'award_profile_complete_bonus'
  ) INTO v_function_ok;

  RAISE NOTICE 'Verification — trigger on_onboarding_complete: %, function award_profile_complete_bonus: %',
    v_trigger_ok, v_function_ok;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
