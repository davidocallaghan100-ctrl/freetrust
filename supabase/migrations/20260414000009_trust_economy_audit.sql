-- ============================================================================
-- Trust Economy Integrity Audit — fixes + safety net
-- ============================================================================
-- Companion to the route + UI fixes that close the following issues
-- surfaced by the integrity audit:
--
-- 1. SUSTAINABILITY FUND BLACK HOLE
--    /api/trust/spend `donate_impact` debited the user via spend_trust
--    but credited NOTHING. There was no fund pool. The trust simply
--    vanished, the /impact "Sustainability Fund Balance" never moved.
--    Fix: introduce an impact_fund_balance singleton + a SECURITY
--    DEFINER `donate_to_impact_fund` RPC that atomically debits the
--    user and credits the fund in a single transaction.
--
-- 2. MAGS MISSING BALANCE
--    Same family of bug as Cliff — Mags created entities BEFORE the
--    earning-path fix landed (commit d245f54). Routes never called
--    awardTrust(). Fix: scan every user's owned entities and issue
--    missing rewards for any creation that has no matching ledger
--    entry. Idempotent — never double-issues.
--
-- 3. CRITICAL SECURITY HOLE — /api/trust POST
--    Any authenticated user could call POST /api/trust with
--    { targetUserId, amount } and mint trust to ANY account, no
--    admin check. Fix: add `is_admin` column to profiles and
--    require the calling user's profile to have it set. Migration
--    sets is_admin = false for everyone (operator must opt-in).
--
-- 4. NO RATE LIMIT ON REPEATABLE ACTIONS
--    `daily_login` (₮1) and other repeatable actions in
--    /api/trust/action had no per-user throttle. A bot could mint
--    unlimited trust by hammering the endpoint. Fix: add
--    trust_action_log table for the route's rate limiter.
--
-- 5. NO AUDIT TRAIL FOR ADMIN MINTS
--    trust_ledger has user_id but no `actor_id` — there's no record
--    of which admin (if any) initiated a manual trust grant.
--    Fix: add nullable actor_id column.
--
-- 6. RECONCILIATION VISIBILITY
--    No way to detect when balance != sum(ledger) for a user
--    without writing ad-hoc SQL. Fix: create a
--    trust_reconciliation view that surfaces every discrepancy.
--
-- All blocks idempotent — DO $$ IF NOT EXISTS guards everywhere.
-- Safe to re-run on any DB state.

-- ── 1. Profiles: is_admin flag ──────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_admin_idx
  ON public.profiles (is_admin)
  WHERE is_admin = true;

-- ── 2. trust_ledger: actor_id audit trail column ────────────────────────────
-- Records WHO initiated a ledger entry. Null for system-generated
-- entries (signup bonus, automatic rewards). Non-null for manual
-- admin grants — the auditor can grep "where actor_id is not null"
-- to surface every human-initiated mint.
ALTER TABLE public.trust_ledger
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trust_ledger_actor_id_idx
  ON public.trust_ledger (actor_id)
  WHERE actor_id IS NOT NULL;

-- Performance index for the idempotency lookups in /api/trust/action
-- and the Mags backfill below — both filter by (user_id, type) and
-- often by reference_id too.
CREATE INDEX IF NOT EXISTS trust_ledger_user_type_idx
  ON public.trust_ledger (user_id, type);

CREATE INDEX IF NOT EXISTS trust_ledger_user_ref_idx
  ON public.trust_ledger (user_id, reference_id)
  WHERE reference_id IS NOT NULL;

-- ── 3. impact_fund_balance: singleton fund pool ─────────────────────────────
-- Tracks the global Sustainability Fund TrustCoin pool. Singleton
-- pattern — id is always 1 — so the donate_to_impact_fund RPC
-- can FOR UPDATE lock the row without worrying about which row.
-- balance = current pool, lifetime = total ever contributed (only
-- ever increases). lifetime is what the /impact UI shows as
-- "Sustainability Fund Balance" since the fund is non-spending in v1.
CREATE TABLE IF NOT EXISTS public.impact_fund_balance (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  balance     bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime    bigint NOT NULL DEFAULT 0 CHECK (lifetime >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row if it doesn't exist.
INSERT INTO public.impact_fund_balance (id, balance, lifetime)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.impact_fund_balance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'impact_fund_balance'
      AND policyname = 'Fund balance is public read'
  ) THEN
    CREATE POLICY "Fund balance is public read"
      ON public.impact_fund_balance FOR SELECT
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.impact_fund_balance TO authenticated, anon;

-- ── 4. donate_to_impact_fund() RPC — atomic donate ──────────────────────────
-- Single round-trip atomic donation:
--   1. Lock the user's trust_balances row FOR UPDATE
--   2. Validate balance >= amount (raises insufficient_funds otherwise)
--   3. Debit user balance + insert negative ledger entry
--   4. Lock impact_fund_balance row FOR UPDATE
--   5. Increment fund balance + lifetime
--   6. Insert into impact_donations (project_id optional — null = general fund)
--   7. Return the new fund balance
--
-- SECURITY DEFINER + SET search_path so the function bypasses RLS
-- cleanly while protecting against search_path manipulation.
--
-- Raises `insufficient_funds` (SQLSTATE P0001) on overdraft so the
-- caller can surface a clean 402 to the UI exactly the same way
-- the existing spend_trust() RPC does.
CREATE OR REPLACE FUNCTION public.donate_to_impact_fund(
  p_user_id    uuid,
  p_amount     integer,
  p_project_id uuid DEFAULT NULL,
  p_desc       text DEFAULT 'Sustainability Fund donation'
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current     integer;
  v_new_fund    bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount: p_amount must be a positive integer (got %)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

  -- 1. Lock the user's balance row, enforcing serial access
  SELECT balance INTO v_current
    FROM public.trust_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_funds: no balance row (requested %, available 0)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds: requested %, available %', p_amount, v_current
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Debit user
  UPDATE public.trust_balances
    SET balance    = balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO public.trust_ledger (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, -p_amount, 'impact_donation', p_project_id, p_desc);

  -- 3. Credit the impact fund pool
  UPDATE public.impact_fund_balance
    SET balance    = balance + p_amount,
        lifetime   = lifetime + p_amount,
        updated_at = now()
    WHERE id = 1
    RETURNING balance INTO v_new_fund;

  -- 4. Record in impact_donations for per-project / per-user history
  --    Allow NULL project_id for general-fund donations from /wallet's
  --    "Impact Fund donation" spend card.
  INSERT INTO public.impact_donations (user_id, project_id, amount)
  VALUES (p_user_id, p_project_id, p_amount);

  -- 5. If a project was specified, increment its raised total too.
  --    Atomically and safely — the fund balance accounting is the
  --    source of truth, the project.raised number is just a cached
  --    UI display total that can be rebuilt from impact_donations
  --    if it ever drifts.
  IF p_project_id IS NOT NULL THEN
    UPDATE public.impact_projects
      SET raised  = COALESCE(raised, 0) + p_amount,
          backers = COALESCE(backers, 0) + 1,
          updated_at = now()
      WHERE id = p_project_id;
  END IF;

  RETURN v_new_fund;
END;
$$;

GRANT EXECUTE ON FUNCTION public.donate_to_impact_fund(uuid, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donate_to_impact_fund(uuid, integer, uuid, text) TO anon;

-- ── 5. trust_action_log: rate limiter for repeatable client actions ─────────
-- /api/trust/action lets users trigger repeatable rewards
-- (daily_login, leave_review, make_purchase, etc.) by POSTing a
-- key. Without a server-side throttle a bot could mint unlimited
-- trust by hammering the endpoint. The route now writes one row
-- per (user_id, action) UPSERT and rejects calls that arrive
-- inside the per-action cooldown window (defined in the route
-- handler in TypeScript, not here, so it can be tuned without
-- a migration).
CREATE TABLE IF NOT EXISTS public.trust_action_log (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      text NOT NULL,
  count       integer NOT NULL DEFAULT 0,
  last_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE public.trust_action_log ENABLE ROW LEVEL SECURITY;

-- Service role only — the route uses the admin client so users
-- cannot inspect or tamper with their own throttle state.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trust_action_log'
      AND policyname = 'Service role manages trust_action_log'
  ) THEN
    CREATE POLICY "Service role manages trust_action_log"
      ON public.trust_action_log FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ── 6. trust_reconciliation view — monitoring + anomaly detection ───────────
-- Sums every user's trust_ledger entries and compares the result
-- against trust_balances.balance. Any row in this view where
-- discrepancy != 0 indicates a partial-write bug or out-of-band
-- mutation. The admin reconcile endpoint reads from this view.
--
-- Created as a regular VIEW (not materialized) so it always
-- reflects the live state without needing manual REFRESH.
CREATE OR REPLACE VIEW public.trust_reconciliation AS
SELECT
  p.id                                     AS user_id,
  p.full_name,
  COALESCE(b.balance, 0)                   AS recorded_balance,
  COALESCE(b.lifetime, 0)                  AS recorded_lifetime,
  COALESCE(SUM(l.amount) FILTER (WHERE l.amount IS NOT NULL), 0)::integer
                                           AS ledger_sum,
  COALESCE(SUM(l.amount) FILTER (WHERE l.amount > 0), 0)::integer
                                           AS ledger_lifetime,
  COALESCE(b.balance, 0) - COALESCE(SUM(l.amount), 0)::integer
                                           AS balance_discrepancy,
  COUNT(l.id) FILTER (WHERE l.id IS NOT NULL) AS ledger_entry_count,
  MAX(l.created_at)                        AS last_ledger_at
FROM public.profiles p
LEFT JOIN public.trust_balances b ON b.user_id = p.id
LEFT JOIN public.trust_ledger   l ON l.user_id = p.id
GROUP BY p.id, p.full_name, b.balance, b.lifetime;

GRANT SELECT ON public.trust_reconciliation TO authenticated;

-- ── 7. Generalised creation reward backfill ─────────────────────────────────
-- For each user, find the entities they own (listings, jobs, events,
-- communities, articles) that have NO matching trust_ledger entry
-- by reference_id, and issue the missing reward via issue_trust().
--
-- The backfill matches the reward amounts in lib/trust/rewards.ts
-- exactly so users get what the product spec promises:
--
--   create_service / create_product = 50
--   create_job                      = 30
--   create_event                    = 50
--   create_community                = 100
--   publish_article                 = 75
--
-- Idempotent: the NOT EXISTS guard skips any creation that already
-- has a ledger entry from a prior backfill run. The whole block is
-- wrapped so it runs once and records progress in a flag column —
-- not used here (trust_ledger entries themselves are the flag).
--
-- Each branch is wrapped in DO $$ BEGIN ... EXCEPTION WHEN OTHERS
-- so a missing column or table on a particular env (e.g. dev DB
-- never had `articles`) doesn't block the rest of the backfill.

-- ─── 7a. Listings (services + products) ─────
DO $$
DECLARE
  rec RECORD;
  v_amount integer;
  v_type text;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT l.id, l.user_id, l.title, COALESCE(l.product_type, 'product') AS product_type
    FROM public.listings l
    WHERE l.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.trust_ledger lg
        WHERE lg.user_id = l.user_id
          AND lg.reference_id = l.id
          AND lg.type IN ('create_service', 'create_product', 'create_listing')
      )
  LOOP
    IF rec.product_type = 'service' THEN
      v_amount := 50; v_type := 'create_service';
    ELSE
      v_amount := 50; v_type := 'create_product';
    END IF;
    PERFORM public.issue_trust(
      rec.user_id, v_amount, v_type, rec.id,
      'Backfill: ' || COALESCE(rec.title, 'listing') || ' (audit 2026-04-15)'
    );
    v_count := v_count + 1;
  END LOOP;
  IF v_count > 0 THEN
    RAISE NOTICE 'Trust backfill: issued % missing listing rewards', v_count;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trust backfill listings skipped: %', SQLERRM;
END $$;

-- ─── 7b. Jobs ─────
DO $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT j.id, j.user_id, j.title
    FROM public.jobs j
    WHERE j.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.trust_ledger lg
        WHERE lg.user_id = j.user_id
          AND lg.reference_id = j.id
          AND lg.type = 'create_job'
      )
  LOOP
    PERFORM public.issue_trust(
      rec.user_id, 30, 'create_job', rec.id,
      'Backfill: job ' || COALESCE(rec.title, '') || ' (audit 2026-04-15)'
    );
    v_count := v_count + 1;
  END LOOP;
  IF v_count > 0 THEN
    RAISE NOTICE 'Trust backfill: issued % missing job rewards', v_count;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trust backfill jobs skipped: %', SQLERRM;
END $$;

-- ─── 7c. Events ─────
-- Try the canonical events table first; fall back is impossible
-- since the column might not exist — handled by the EXCEPTION clause.
DO $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT e.id, e.organizer_id AS user_id, e.title
    FROM public.events e
    WHERE e.organizer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.trust_ledger lg
        WHERE lg.user_id = e.organizer_id
          AND lg.reference_id = e.id
          AND lg.type = 'create_event'
      )
  LOOP
    PERFORM public.issue_trust(
      rec.user_id, 50, 'create_event', rec.id,
      'Backfill: event ' || COALESCE(rec.title, '') || ' (audit 2026-04-15)'
    );
    v_count := v_count + 1;
  END LOOP;
  IF v_count > 0 THEN
    RAISE NOTICE 'Trust backfill: issued % missing event rewards', v_count;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trust backfill events skipped: %', SQLERRM;
END $$;

-- ─── 7d. Communities ─────
DO $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT c.id, c.owner_id AS user_id, c.name
    FROM public.communities c
    WHERE c.owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.trust_ledger lg
        WHERE lg.user_id = c.owner_id
          AND lg.reference_id = c.id
          AND lg.type = 'create_community'
      )
  LOOP
    PERFORM public.issue_trust(
      rec.user_id, 100, 'create_community', rec.id,
      'Backfill: community ' || COALESCE(rec.name, '') || ' (audit 2026-04-15)'
    );
    v_count := v_count + 1;
  END LOOP;
  IF v_count > 0 THEN
    RAISE NOTICE 'Trust backfill: issued % missing community rewards', v_count;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trust backfill communities skipped: %', SQLERRM;
END $$;

-- ─── 7e. Articles ─────
DO $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT a.id, a.author_id AS user_id, a.title
    FROM public.articles a
    WHERE a.author_id IS NOT NULL
      AND a.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM public.trust_ledger lg
        WHERE lg.user_id = a.author_id
          AND lg.reference_id = a.id
          AND lg.type = 'publish_article'
      )
  LOOP
    PERFORM public.issue_trust(
      rec.user_id, 75, 'publish_article', rec.id,
      'Backfill: article ' || COALESCE(rec.title, '') || ' (audit 2026-04-15)'
    );
    v_count := v_count + 1;
  END LOOP;
  IF v_count > 0 THEN
    RAISE NOTICE 'Trust backfill: issued % missing article rewards', v_count;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trust backfill articles skipped: %', SQLERRM;
END $$;

-- ── 8. Mags-specific welcome bonus check ────────────────────────────────────
-- Belt-and-braces: if Mags exists and has no signup_bonus row in
-- her ledger, issue ₮200. The general backfill above only covers
-- creations; signup bonus needs its own check.
DO $$
DECLARE
  v_user_id  uuid;
  v_existing int;
BEGIN
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE first_name ILIKE 'mags'
     OR full_name  ILIKE 'mags %'
     OR full_name  ILIKE 'mags'
     OR first_name ILIKE 'margaret'
  LIMIT 2;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Mags retroactive grant: no matching profile, skipping';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_existing
  FROM public.trust_ledger
  WHERE user_id = v_user_id
    AND type = 'signup_bonus';

  IF v_existing > 0 THEN
    RAISE NOTICE 'Mags retroactive grant: already has signup_bonus, skipping';
    RETURN;
  END IF;

  PERFORM public.issue_trust(
    v_user_id, 200, 'signup_bonus', NULL,
    'Retroactive: missed signup bonus (audit 2026-04-15)'
  );
  RAISE NOTICE 'Mags retroactive signup bonus: awarded +200 to %', v_user_id;
END $$;

-- ── 9. Reload PostgREST schema cache ────────────────────────────────────────
-- Forces every PostgREST worker to re-introspect immediately so the
-- new RPC, table, view, columns and policies are picked up without
-- a worker restart.
NOTIFY pgrst, 'reload schema';
