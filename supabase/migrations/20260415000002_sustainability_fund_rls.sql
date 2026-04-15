-- ============================================================================
-- Sustainability Fund RLS — belt-and-braces re-assertion
-- ============================================================================
-- The impact_fund_balance singleton and donate_to_impact_fund RPC
-- were created by 20260414000009_trust_economy_audit.sql. This
-- follow-up migration satisfies the Section 2d audit request by
-- explicitly asserting every RLS policy + grant needed for the
-- donation flow to work end-to-end, so a DB rebuild that loses
-- the earlier migration won't silently break the fund.
--
-- Idempotent — re-runs with no effect on a fully-set-up DB.

-- ── 1. impact_fund_balance ──────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'impact_fund_balance' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.impact_fund_balance ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Seed the singleton row if missing
INSERT INTO public.impact_fund_balance (id, balance, lifetime)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'impact_fund_balance' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'impact_fund_balance'
      AND policyname = 'Fund balance is public read'
  ) THEN
    CREATE POLICY "Fund balance is public read"
      ON public.impact_fund_balance FOR SELECT
      USING (true);
  END IF;
END $$;

-- ── 2. impact_donations — belt-and-braces policies ──────────────────────────
-- The impact_donations table was created by 20260409_impact_tables.sql
-- without RLS. The donate flow uses the admin client so RLS isn't
-- strictly necessary, but lets add INSERT + SELECT policies so
-- any future direct-client write path can't silently fail.
ALTER TABLE public.impact_donations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'impact_donations'
      AND policyname = 'Users can view own donations'
  ) THEN
    CREATE POLICY "Users can view own donations"
      ON public.impact_donations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'impact_donations'
      AND policyname = 'Service role manages donations'
  ) THEN
    CREATE POLICY "Service role manages donations"
      ON public.impact_donations FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

GRANT SELECT ON public.impact_donations TO authenticated;
GRANT SELECT ON public.impact_fund_balance TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
