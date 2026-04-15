-- ============================================================================
-- Sustainability Fund — end-to-end fix
-- ============================================================================
-- Fixes the "Sustainability Fund balance never updates" bug on /impact.
--
-- Root cause (six layered failures):
--
--   1. No `impact_fund_balance` singleton table existed at all. The
--      original migration 20260409_impact_tables.sql created
--      impact_projects, impact_donations and impact_cause_votes but
--      never the fund balance row. The /impact UI tried to render a
--      "Sustainability Fund Balance" pulled from /api/impact/stats,
--      and stats had to manufacture one out of thin air.
--
--   2. /api/impact/stats computed fundBalance as
--          SUM(impact_projects.raised) + SUM(impact_donations.amount)
--      Donating ₮10 to a project increments BOTH the project.raised
--      column AND inserts a row in impact_donations, so the displayed
--      fund balance jumped by ₮20 on every donation. The base value
--      was also seeded with euro figures from the project goals
--      (~€629,100) so the "fund balance" was never a real number.
--
--   3. /api/impact/donate did four separate writes (issue_trust call,
--      impact_donations insert, impact_projects update, notification
--      insert) with try/catch around the whole thing. A partial
--      failure left trust deducted but no donation recorded — the
--      classic non-atomic-donation bug. It also called
--      issue_trust(-amount), which has no insufficient-funds check
--      and would insert balance=-10 on a first-time donor (caught
--      by the CHECK constraint, but as an opaque 23514 error rather
--      than a clean P0001).
--
--   4. The donate route required project_id — there was no path to
--      donate to the fund directly, even though the hero CTA implies
--      one.
--
--   5. The /impact page never refetched stats after a successful
--      donation. It did optimistic local updates on trustBalance and
--      projects[i].raised but never touched stats.fundBalance, so the
--      headline "Sustainability Fund Balance" display stayed stale
--      until a hard reload. Users saw "₮{amount} donated!" toast but
--      the fund number didn't move — looked like the donation failed.
--
--   6. impact_donations, impact_projects and the new singleton table
--      had no explicit RLS policies. Reads happened to work because
--      RLS wasn't enabled on impact_donations / impact_projects, but
--      this was accidental — turning on RLS later would have broken
--      everything silently.
--
-- Fix (this migration, in order):
--
--   * Create impact_fund_balance singleton table with id PRIMARY KEY,
--     balance integer (spendable), lifetime integer (all-time donated)
--     and seed the id=1 row.
--   * ADD COLUMN IF NOT EXISTS project_id on impact_donations as a
--     belt-and-braces no-op (the column exists from the original
--     migration but the column add is idempotent).
--   * CREATE OR REPLACE FUNCTION donate_to_impact_fund(p_user_id,
--     p_amount, p_project_id, p_desc) RETURNS jsonb — atomic. Locks
--     the trust_balances row FOR UPDATE, validates sufficient funds,
--     debits the user, writes a 'impact_donation' ledger row, bumps
--     the singleton balance + lifetime, inserts the impact_donations
--     row, optionally updates impact_projects.raised + backers, and
--     returns the new fund balance + amount donated as JSON.
--   * SECURITY DEFINER + SET search_path = public so the RPC bypasses
--     RLS cleanly and is safe against search_path manipulation.
--   * GRANT EXECUTE on the new RPC to authenticated and anon.
--   * Enable RLS on all three impact tables and add the policies the
--     spec requires:
--       - impact_fund_balance: SELECT for everyone (public read)
--       - impact_donations: INSERT for authenticated, SELECT own row,
--         service role does whatever it wants
--       - impact_projects: SELECT for everyone, UPDATE for service
--         role only (donate_to_impact_fund handles user-driven
--         updates via SECURITY DEFINER)
--   * NOTIFY pgrst, 'reload schema' so the new RPC and policies show
--     up in the REST API immediately.
--
-- Idempotent — safe to re-run. CREATE TABLE IF NOT EXISTS, CREATE OR
-- REPLACE FUNCTION, DO $$ IF NOT EXISTS for policies, ENABLE RLS is a
-- no-op if already on.

-- ── 1. impact_fund_balance singleton table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.impact_fund_balance (
  id         integer PRIMARY KEY DEFAULT 1,
  balance    integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime   integer NOT NULL DEFAULT 0 CHECK (lifetime >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT impact_fund_balance_singleton CHECK (id = 1)
);

-- Seed the id=1 row if it doesn't already exist.
INSERT INTO public.impact_fund_balance (id, balance, lifetime)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Defensive: ensure project_id column exists on impact_donations ─────
-- The original migration creates this column but a future schema
-- rebuild could drop it, so re-assert here.
ALTER TABLE public.impact_donations
  ADD COLUMN IF NOT EXISTS project_id uuid
  REFERENCES public.impact_projects(id) ON DELETE SET NULL;

-- ── 3. donate_to_impact_fund() RPC — atomic donation ───────────────────────
-- SECURITY DEFINER so it bypasses RLS on writes. SET search_path
-- protects against privilege escalation. Locks the trust_balances
-- row FOR UPDATE so concurrent donations from the same user can't
-- race past the insufficient-funds check.
CREATE OR REPLACE FUNCTION public.donate_to_impact_fund(
  p_user_id    uuid,
  p_amount     integer,
  p_project_id uuid DEFAULT NULL,
  p_desc       text DEFAULT 'Sustainability Fund donation'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current  integer;
  v_new_fund integer;
  v_new_user integer;
BEGIN
  -- Validate the amount up front. The caller should have already
  -- done this, but a negative or zero amount sneaking through would
  -- bypass the overdraft check below and produce nonsense ledger /
  -- donation rows.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount: must be positive (got %)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock the user's balance row FOR UPDATE so concurrent donations
  -- from the same user serialise. Without the lock, two parallel
  -- ₮100 donations on a ₮150 balance could both pass the check and
  -- both commit, leaving the balance at -50 (caught by the CHECK
  -- constraint as an opaque 23514 error rather than a clean P0001).
  SELECT balance INTO v_current
    FROM public.trust_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

  -- No row at all means the user has never earned any trust. Treat
  -- as a zero balance and raise the standard error so the caller
  -- renders the same "not enough trust" UI in both cases.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_funds: no balance row (requested %, available 0)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds: requested %, available %', p_amount, v_current
      USING ERRCODE = 'P0001';
  END IF;

  -- Atomic debit. lifetime stays unchanged on the user's row — it
  -- tracks total earned, not net-of-spend, so a donor still shows
  -- their full lifetime number in the wallet.
  UPDATE public.trust_balances
    SET balance    = balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_user;

  -- Record the debit in the ledger so it shows up in wallet history
  -- with the standard 'impact_donation' type. reference_id points to
  -- the project if one was supplied, otherwise NULL for a fund-only
  -- donation.
  INSERT INTO public.trust_ledger
    (user_id, amount, type, reference_id, description)
  VALUES
    (p_user_id, -p_amount, 'impact_donation', p_project_id, p_desc);

  -- Bump the fund singleton — both spendable balance and lifetime
  -- counters. RETURNING gives us the new balance to return to the
  -- caller without an extra round-trip.
  UPDATE public.impact_fund_balance
    SET balance    = balance  + p_amount,
        lifetime   = lifetime + p_amount,
        updated_at = now()
    WHERE id = 1
    RETURNING balance INTO v_new_fund;

  -- Self-heal: if the singleton row is somehow missing (e.g. someone
  -- TRUNCATEd the table), insert it with the donation amount as the
  -- starting balance. This keeps the donation flow from blowing up
  -- on a misconfigured database.
  IF v_new_fund IS NULL THEN
    INSERT INTO public.impact_fund_balance (id, balance, lifetime)
    VALUES (1, p_amount, p_amount)
    RETURNING balance INTO v_new_fund;
  END IF;

  -- Record the donation row.
  INSERT INTO public.impact_donations
    (user_id, project_id, amount)
  VALUES
    (p_user_id, p_project_id, p_amount);

  -- Optional project update — only when the donor picked a specific
  -- project rather than donating to the general fund.
  IF p_project_id IS NOT NULL THEN
    UPDATE public.impact_projects
      SET raised     = COALESCE(raised, 0)  + p_amount,
          backers    = COALESCE(backers, 0) + 1,
          updated_at = now()
      WHERE id = p_project_id;
  END IF;

  RETURN jsonb_build_object(
    'new_fund_balance', v_new_fund,
    'new_user_balance', v_new_user,
    'amount_donated',   p_amount,
    'project_id',       p_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.donate_to_impact_fund(uuid, integer, uuid, text)
  TO authenticated, anon;

-- ── 4. RLS — impact_fund_balance: public SELECT, no public writes ──────────
ALTER TABLE public.impact_fund_balance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'impact_fund_balance'
      AND policyname = 'Public can read fund balance'
  ) THEN
    CREATE POLICY "Public can read fund balance"
      ON public.impact_fund_balance
      FOR SELECT
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.impact_fund_balance TO anon, authenticated;

-- ── 5. RLS — impact_donations: insert own, read own ────────────────────────
ALTER TABLE public.impact_donations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'impact_donations'
      AND policyname = 'Authenticated users can insert own donation'
  ) THEN
    CREATE POLICY "Authenticated users can insert own donation"
      ON public.impact_donations
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'impact_donations'
      AND policyname = 'Users can read own donations'
  ) THEN
    CREATE POLICY "Users can read own donations"
      ON public.impact_donations
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- The leaderboard route reads ALL donations to aggregate by user_id.
  -- It runs through the user-session client (not admin), so it needs
  -- a public-read policy or it'll see an empty list. Match the same
  -- "public read of aggregate-only fields" pattern used by
  -- 20260411_trust_balances_public_read.sql.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'impact_donations'
      AND policyname = 'Public can read donations for leaderboard'
  ) THEN
    CREATE POLICY "Public can read donations for leaderboard"
      ON public.impact_donations
      FOR SELECT
      USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT ON public.impact_donations TO authenticated;
GRANT SELECT ON public.impact_donations TO anon;

-- ── 6. RLS — impact_projects: public SELECT, service-role UPDATE ───────────
ALTER TABLE public.impact_projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'impact_projects'
      AND policyname = 'Public can read impact projects'
  ) THEN
    CREATE POLICY "Public can read impact projects"
      ON public.impact_projects
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- impact_projects is updated only by donate_to_impact_fund() (which
-- is SECURITY DEFINER and therefore bypasses RLS) and by service-role
-- admin code. We deliberately do NOT add an UPDATE policy for
-- authenticated users — a direct-update path from the user-session
-- client is not allowed.

GRANT SELECT ON public.impact_projects TO anon, authenticated;

-- ── 7. Reload PostgREST schema cache ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
