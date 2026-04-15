-- ============================================================================
-- Withdrawals table — track Stripe payout requests + lifecycle
-- ============================================================================
-- Companion to the new POST /api/stripe/payout endpoint and the new
-- payout.paid / payout.failed webhook handlers. Before this migration
-- the only "Withdraw" path on /wallet was a redirect to the Stripe
-- Express dashboard where users had to manually initiate payouts via
-- Stripe's UI. We never created in-platform records, never validated
-- amounts against available balance, and never showed payout history.
--
-- This migration creates the canonical record of every payout
-- request the FreeTrust UI initiated, the Stripe ids needed to
-- match webhook events back to the originating row, and the
-- buyer/seller-side bookkeeping we need to reflect "withdrawn"
-- amounts in /api/wallet's available-balance calculation.
--
-- Idempotent — every CREATE TABLE / CREATE POLICY / CREATE INDEX
-- block is wrapped in IF NOT EXISTS or DO $$ EXISTS guards.

-- ── 1. withdrawals table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Amount in pence/cents (integer, no float drift). currency is the
  -- ISO 4217 code (lower case to match Stripe's payload conventions
  -- e.g. 'eur').
  amount_cents             integer NOT NULL CHECK (amount_cents > 0),
  currency                 text    NOT NULL DEFAULT 'eur',

  -- Stripe ids — populated as soon as the API call returns.
  -- stripe_transfer_id is the Transfer object that moves money from
  -- the platform balance to the connected account. stripe_payout_id
  -- is the subsequent Payout object the connected account creates
  -- to move money from its Stripe balance to the user's bank.
  --
  -- For platform-owned charges + separate transfers (the model used
  -- by /api/checkout/product + /api/checkout/service today), we
  -- create a Transfer first then optionally trigger a Payout.
  stripe_account_id        text    NOT NULL,
  stripe_transfer_id       text,
  stripe_payout_id         text,

  -- Lifecycle state machine:
  --   pending     — row created, transfer/payout not yet initiated
  --   processing  — Stripe accepted the call, awaiting payout.paid webhook
  --   paid        — payout.paid webhook received, money is in the user's bank
  --   failed      — payout.failed (or transfer create) returned an error
  --   cancelled   — manually cancelled (kept for future admin tooling)
  status                   text    NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','processing','paid','failed','cancelled')),

  -- Surfaced to the user when status='failed'. For Stripe errors this
  -- is the StripeError.message; for our own validation failures it's
  -- the human-readable reason (e.g. "insufficient balance").
  failure_reason           text,

  -- Estimated arrival time returned by Stripe at payout creation,
  -- for the "you should see this in your bank in ~2 business days"
  -- success toast. Stored as a unix epoch seconds integer to match
  -- the shape of Stripe.Payout.arrival_date.
  arrival_estimate_epoch   bigint,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS withdrawals_user_id_created_at_idx
  ON public.withdrawals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS withdrawals_stripe_payout_id_idx
  ON public.withdrawals (stripe_payout_id)
  WHERE stripe_payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS withdrawals_stripe_transfer_id_idx
  ON public.withdrawals (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own withdrawals (for the wallet history list).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'withdrawals'
      AND policyname = 'Users can view own withdrawals'
  ) THEN
    CREATE POLICY "Users can view own withdrawals"
      ON public.withdrawals FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Only the service role can INSERT / UPDATE — the API route uses the
-- admin client to write rows so it can run after validating against
-- the user's available balance (which is computed server-side from
-- orders/deposits/transfers in /api/wallet). Direct user-session
-- inserts could otherwise sneak past the balance check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'withdrawals'
      AND policyname = 'Service role manages withdrawals'
  ) THEN
    CREATE POLICY "Service role manages withdrawals"
      ON public.withdrawals FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Table-level grants — re-grant at the table level to make sure no
-- prior column-level grant masks the new INSERT/UPDATE. anon gets
-- nothing (withdrawals are a logged-in feature only).
GRANT SELECT ON public.withdrawals TO authenticated;

-- ── 4. updated_at trigger ───────────────────────────────────────────────────
-- Standard moddatetime pattern so callers don't have to hand-set
-- updated_at on every UPDATE. Wrapped in DO $$ for idempotency.
CREATE OR REPLACE FUNCTION public.set_withdrawals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'withdrawals_set_updated_at'
  ) THEN
    CREATE TRIGGER withdrawals_set_updated_at
      BEFORE UPDATE ON public.withdrawals
      FOR EACH ROW
      EXECUTE FUNCTION public.set_withdrawals_updated_at();
  END IF;
END $$;

-- ── 5. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
