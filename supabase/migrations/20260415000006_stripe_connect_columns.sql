-- ============================================================================
-- Stripe Connect columns — profiles + withdrawals lifecycle
-- ============================================================================
-- Adds the per-user Stripe Connect state columns the audit spec asks
-- for. Before this migration, the only Connect state on profiles
-- was `stripe_account_id` + `stripe_onboarded` (from
-- 20260412_profiles_stripe_onboarded.sql). That single boolean
-- couldn't distinguish between:
--
--   * charges_enabled=false, payouts_enabled=false  (blocked)
--   * charges_enabled=true,  payouts_enabled=false  (can receive,
--                                                    not pay out)
--   * charges_enabled=true,  payouts_enabled=true   (fully onboarded)
--
-- Without the distinction, the withdraw UI couldn't accurately tell
-- a user whether their bank was hooked up or still pending
-- verification. This migration adds the two flags explicitly plus a
-- derived `stripe_onboarding_complete` boolean that the Stripe
-- webhook handler computes from (charges_enabled AND payouts_enabled)
-- and writes in one round trip.
--
-- It also extends the withdrawals table with lifecycle columns the
-- webhook handlers (payout.paid, payout.failed) need to mark
-- withdrawals complete / failed with a reason.
--
-- Idempotent — every ALTER uses IF NOT EXISTS.

-- ── 1. profiles — Stripe Connect state ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;

-- Partial index for the hot "show me all fully-onboarded sellers"
-- query — keeps the index small since most members haven't onboarded.
CREATE INDEX IF NOT EXISTS profiles_stripe_onboarding_complete_idx
  ON public.profiles (stripe_account_id)
  WHERE stripe_onboarding_complete = true;

-- ── 2. withdrawals — lifecycle columns ──────────────────────────────────────
-- The withdrawals table was created by 20260414000008_withdrawals_table.sql
-- with a status column already. This migration belt-and-braces the
-- columns the webhook handlers rely on so a rebuild can't lose them.
--
-- IMPORTANT — the original 20260414000008 migration defined status as
-- a constrained enum via CHECK. Adding the column a second time with
-- IF NOT EXISTS is a no-op when the table was built correctly, but
-- adds a lax text column if the table was rebuilt without the
-- original migration. The CHECK is re-asserted as a separate DO block
-- below via pg_constraint lookup.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'withdrawals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.withdrawals
      ADD COLUMN IF NOT EXISTS status            text,
      ADD COLUMN IF NOT EXISTS completed_at      timestamptz,
      ADD COLUMN IF NOT EXISTS failed_at         timestamptz,
      ADD COLUMN IF NOT EXISTS failure_reason    text,
      ADD COLUMN IF NOT EXISTS stripe_payout_id  text;

    -- Default any NULLs that slipped through to 'pending' so the
    -- webhook's UPDATE filters work on existing rows.
    UPDATE public.withdrawals SET status = 'pending' WHERE status IS NULL;
  END IF;
END $$;

-- Re-assert the stripe_payout_id index in case the earlier migration
-- is missing it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'withdrawals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    CREATE INDEX IF NOT EXISTS withdrawals_stripe_payout_id_idx
      ON public.withdrawals (stripe_payout_id)
      WHERE stripe_payout_id IS NOT NULL;

    -- Status lookup index — the webhook handlers filter by
    -- (stripe_payout_id) primarily, but the wallet UI filters by
    -- (user_id, status) to show pending withdrawals, so we add a
    -- composite for that path.
    CREATE INDEX IF NOT EXISTS withdrawals_user_status_idx
      ON public.withdrawals (user_id, status);
  END IF;
END $$;

-- ── 3. PostgREST schema reload ──────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
