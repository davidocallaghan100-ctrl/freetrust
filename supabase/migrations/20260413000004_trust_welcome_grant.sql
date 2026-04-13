-- Trust welcome grant — idempotent scaffold for trust_balances, trust_ledger,
-- issue_trust() RPC, and the INSERT RLS policies the signup-bonus flow needs.
-- ============================================================================
-- Fixes the runtime bug: new users completing signup received ₮0 Trust,
-- even though the register page, /api/auth/signup-bonus, and /auth/callback
-- all claim to grant ₮25.
--
-- Root cause (three layered failures):
--
--   1. `issue_trust()` was defined only in lib/supabase/schema.sql (the
--      one-time initial-setup file), NOT in a migration. On a live DB
--      built migration-by-migration, the function may not exist — the
--      supabase.rpc('issue_trust', ...) calls in both the signup-bonus
--      route and the callback route then fail with "function does not
--      exist" and fall through to the fallback path.
--
--   2. The fallback path does a direct insert into trust_balances /
--      trust_ledger. Both tables have RLS enabled with SELECT policies
--      only — there is no INSERT policy for authenticated users.
--      The user-session Supabase client hits RLS denial and the write
--      silently fails.
--
--   3. Both API routes wrap the whole flow in try/catch with the catch
--      body either swallowing the error ({} empty) or returning non-
--      actionable text to a client that already discards it. Production
--      logs never saw the failure, hence the bug survived months.
--
-- Fix (this migration):
--
--   * CREATE TABLE IF NOT EXISTS trust_balances + trust_ledger — so the
--     migration is a no-op on a fully-initialised DB but self-heals if
--     either table was missing.
--   * CREATE OR REPLACE FUNCTION public.issue_trust(...) as SECURITY
--     DEFINER so the RPC path succeeds regardless of RLS, and GRANT
--     EXECUTE to authenticated so callers can reach it.
--   * Add explicit INSERT RLS policies on both tables scoped to
--     auth.uid() = user_id, as a belt-and-braces fallback for code
--     paths that can't use the admin client or the RPC.
--   * Re-GRANT SELECT, INSERT on both tables at the TABLE level to
--     authenticated + anon to beat any column-level grant masking —
--     same pattern used in 20260413000001_listings_category_column.sql.
--   * NOTIFY pgrst, 'reload schema' to force a PostgREST cache rebuild
--     so new grants and policies are picked up immediately.
--
-- Safe to re-run. Every statement is idempotent.

-- ── 1. Tables ────────────────────────────────────────────────────────────────
-- Match the shape in lib/supabase/schema.sql so CREATE IF NOT EXISTS
-- never conflicts with an already-existing definition.

CREATE TABLE IF NOT EXISTS public.trust_balances (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime   integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trust_ledger (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       integer NOT NULL,
  type         text NOT NULL,
  reference_id uuid,
  description  text,
  created_at   timestamptz DEFAULT now()
);

-- ── 2. issue_trust() RPC ─────────────────────────────────────────────────────
-- SECURITY DEFINER so it runs with the function owner's privileges,
-- bypassing RLS on the write path. This is the primary grant path —
-- the fallback direct inserts below only fire if this RPC call fails.

CREATE OR REPLACE FUNCTION public.issue_trust(
  p_user_id uuid,
  p_amount  integer,
  p_type    text,
  p_ref     uuid,
  p_desc    text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trust_ledger (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, p_amount, p_type, p_ref, p_desc);

  INSERT INTO public.trust_balances (user_id, balance, lifetime)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET
    balance    = public.trust_balances.balance  + p_amount,
    lifetime   = public.trust_balances.lifetime + GREATEST(p_amount, 0),
    updated_at = now();
END;
$$;

-- Expose the RPC to every authenticated user. The function's SECURITY
-- DEFINER + SET search_path protects against privilege escalation.
GRANT EXECUTE ON FUNCTION public.issue_trust(uuid, integer, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_trust(uuid, integer, text, uuid, text) TO anon;

-- ── 3. RLS policies ──────────────────────────────────────────────────────────
-- Ensure RLS is enabled (no-op if already enabled).
ALTER TABLE public.trust_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_ledger   ENABLE ROW LEVEL SECURITY;

-- Public read on trust_balances was added by
-- 20260411_trust_balances_public_read.sql. We don't touch it here —
-- just ensure the INSERT policy exists for the fallback write path.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'trust_balances'
      AND policyname = 'Users can insert own balance row'
  ) THEN
    CREATE POLICY "Users can insert own balance row"
      ON public.trust_balances
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- trust_ledger: existing "Users view own ledger" SELECT policy is
-- compatible. Add an INSERT policy for the fallback path.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'trust_ledger'
      AND policyname = 'Users can view own ledger'
  ) THEN
    CREATE POLICY "Users can view own ledger"
      ON public.trust_ledger
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'trust_ledger'
      AND policyname = 'Users can insert own ledger entry'
  ) THEN
    CREATE POLICY "Users can insert own ledger entry"
      ON public.trust_ledger
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Table-level grants ────────────────────────────────────────────────────
-- Re-grant at the TABLE level so any prior column-level grant that might
-- be masking a column is overridden. Same fix pattern as
-- 20260413000001_listings_category_column.sql.

GRANT SELECT, INSERT ON public.trust_balances TO authenticated;
GRANT SELECT         ON public.trust_balances TO anon;

GRANT SELECT, INSERT ON public.trust_ledger   TO authenticated;

-- ── 5. Reload the PostgREST schema cache ─────────────────────────────────────
-- Forces every PostgREST worker to re-introspect the schema so the new
-- RPC and policies are picked up immediately instead of waiting for the
-- next restart.
NOTIFY pgrst, 'reload schema';
