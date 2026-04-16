-- ============================================================================
-- Escrow columns — true hold-until-complete payment model
-- ============================================================================
-- Companion to the code change that switches FreeTrust's checkout to
-- capture_method: 'manual' (PaymentIntent held in `requires_capture`)
-- with an explicit stripe.paymentIntents.capture() + stripe.transfers
-- .create() when the buyer releases payment. Before this, the
-- checkout immediately transferred funds to the seller via the
-- destination-charge pattern and the DB's `escrow_released_at`
-- column was cosmetic. Now the money genuinely sits on the platform
-- account until release.
--
-- Three additions to `orders`:
--
--   1. stripe_payment_intent_id — the PaymentIntent we'll capture on
--      release (or cancel on dispute). Back-filled from the existing
--      `stripe_payment_intent` column so both names work post-migration
--      and we can migrate the codebase to the canonical spec column
--      name gradually.
--   2. stripe_transfer_id — the resulting Transfer id after release,
--      for audit-trail and future refund support.
--   3. cancelled_at — timestamp set when the PaymentIntent is
--      cancelled (buyer / admin dispute flow). Keeps a clean
--      signal for "money never moved to the seller".
--
-- One addition to `profiles`:
--
--   stripe_onboarding_complete boolean — spec-named gate column used
--   by /api/listings and /api/create/publish to block paid listings
--   from sellers who haven't completed Stripe Connect onboarding.
--   Back-filled from the existing `stripe_onboarded` column, and
--   kept in sync both directions via a trigger so either column is
--   a valid read.
--
-- Idempotent — safe to re-run.

-- ── 1. orders columns ───────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id       text,
  ADD COLUMN IF NOT EXISTS cancelled_at             timestamptz;

-- Back-fill: carry the existing `stripe_payment_intent` values into
-- the new canonical column so release_payment can read either one.
-- Only touches rows where the new column is null so it's safe on
-- replay and on databases that never had stripe_payment_intent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'orders'
       AND column_name  = 'stripe_payment_intent'
  ) THEN
    EXECUTE $backfill$
      UPDATE public.orders
         SET stripe_payment_intent_id = stripe_payment_intent
       WHERE stripe_payment_intent_id IS NULL
         AND stripe_payment_intent   IS NOT NULL
         AND stripe_payment_intent   <> ''
    $backfill$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_stripe_pi_idx
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_stripe_transfer_idx
  ON public.orders (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

-- ── 2. profiles.stripe_onboarding_complete ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;

-- Back-fill from the existing `stripe_onboarded` column. Only
-- executes if the source column exists, which it should (added by
-- 20260412_profiles_stripe_onboarded.sql).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'profiles'
       AND column_name  = 'stripe_onboarded'
  ) THEN
    EXECUTE $backfill$
      UPDATE public.profiles
         SET stripe_onboarding_complete = true
       WHERE stripe_onboarded = true
         AND stripe_onboarding_complete = false
    $backfill$;
  END IF;
END $$;

-- Trigger: keep stripe_onboarded and stripe_onboarding_complete in
-- sync in both directions so existing code that writes to either
-- column stays correct without a sweep through every route.
CREATE OR REPLACE FUNCTION public.sync_stripe_onboarding_cols()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If either column was set to true, both become true. If either
  -- was set to false and the other is already false, both stay
  -- false. (A caller who explicitly flips a true back to false
  -- wins — normal UPDATE precedence.)
  IF NEW.stripe_onboarded IS DISTINCT FROM OLD.stripe_onboarded THEN
    NEW.stripe_onboarding_complete := NEW.stripe_onboarded;
  ELSIF NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete THEN
    NEW.stripe_onboarded := NEW.stripe_onboarding_complete;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_stripe_onboarding ON public.profiles;
CREATE TRIGGER profiles_sync_stripe_onboarding
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_stripe_onboarding_cols();

-- ── 3. Reload PostgREST schema cache ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
