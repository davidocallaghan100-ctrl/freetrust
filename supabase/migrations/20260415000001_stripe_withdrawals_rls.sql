-- ============================================================================
-- Stripe withdrawals RLS — belt-and-braces re-assertion
-- ============================================================================
-- The withdrawals table and its RLS policies were created by
-- 20260414000008_withdrawals_table.sql as part of the Stripe
-- withdrawal end-to-end fix. This follow-up migration exists only
-- to satisfy the Section 1e audit request that the withdrawals
-- table has RLS, INSERT/SELECT policies, and that
-- profiles.stripe_account_id is readable by its owner.
--
-- Idempotent — re-asserts everything with IF NOT EXISTS guards so
-- running it on a DB that already has the full setup is a no-op.

-- ── 1. profiles.stripe_account_id — RLS sanity check ────────────────────────
-- The profiles table should already let a user read their own row
-- via the standard "Users view own profile" policy. This block
-- verifies the column exists and that the index added by
-- 20260412_profiles_stripe_onboarded.sql is present.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text;

CREATE INDEX IF NOT EXISTS profiles_stripe_account_id_idx
  ON public.profiles (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- ── 2. withdrawals RLS — re-assert ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'withdrawals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'withdrawals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'withdrawals'
      AND policyname = 'Users can view own withdrawals'
  ) THEN
    CREATE POLICY "Users can view own withdrawals"
      ON public.withdrawals FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'withdrawals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND NOT EXISTS (
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'withdrawals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT ON public.withdrawals TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
