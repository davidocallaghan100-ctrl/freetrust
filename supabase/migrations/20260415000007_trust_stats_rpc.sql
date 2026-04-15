-- ============================================================================
-- trust_stats() RPC — single source of truth for homepage trust figures
-- ============================================================================
-- Fixes the live-data bug where the homepage showed:
--
--   ₮ in circulation:     ₮2,285   ← sum of trust_balances.balance
--   ₮ issued since launch: ₮1,550  ← sum of trust_balances.lifetime
--
-- which is logically impossible — circulation must always be ≤ total
-- ever issued. Three root causes combined to produce the inversion:
--
--   1. 1000-ROW DEFAULT LIMIT. /api/stats/route.ts was using
--      `supabase.from('trust_balances').select('balance')` and
--      `.select('lifetime')` with no explicit limit. Supabase's
--      PostgREST backend caps responses at 1000 rows by default.
--      At any meaningful scale the two parallel fetches could
--      silently truncate to DIFFERENT 1000-row subsets and produce
--      contradictory sums.
--
--   2. LIFETIME DRIFT. The `lifetime` column on trust_balances is
--      incremented by issue_trust() via
--      `lifetime = lifetime + GREATEST(p_amount, 0)`. That's correct
--      for new calls, but historic rows inserted before the Cliff/
--      Mags audit migrations — or via direct Supabase Studio edits
--      — could have a `lifetime` value lower than
--      `SUM(GREATEST(trust_ledger.amount, 0))` for the same user.
--      reconcile_trust_balances() (added 20260415000003) only
--      reconciles `balance`, not `lifetime`, so any pre-existing
--      drift in `lifetime` stayed permanent.
--
--   3. NO CROSS-COLUMN INVARIANT ENFORCEMENT. Summing two different
--      columns in JS has no way to enforce that one is a floor for
--      the other. The invariant must be enforced at query time.
--
-- This migration ships three fixes:
--
--   A. trust_stats() SECURITY DEFINER SQL function that computes
--      both figures from the authoritative trust_ledger in one
--      round trip, with GREATEST clamping so circulation can never
--      visually exceed total_issued even if the two source tables
--      disagree.
--
--   B. One-time lifetime backfill that recomputes every user's
--      `lifetime` column from `SUM(GREATEST(trust_ledger.amount, 0))`
--      so existing data matches the ledger again. This runs inside
--      the migration and emits a NOTICE with the count of corrected
--      rows.
--
--   C. The /api/stats/route.ts handler (in a companion commit) is
--      updated to call this RPC instead of the two JS-side sums,
--      eliminating the 1000-row truncation issue.
--
-- Idempotent — safe to re-run. CREATE OR REPLACE FUNCTION updates
-- the body in place; the backfill is a UPDATE ... WHERE IS DISTINCT
-- FROM which no-ops on a clean DB.

-- ── 1. trust_stats() RPC ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trust_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ledger_stats AS (
    -- Gross issuance = sum of every POSITIVE ledger entry, filtering
    -- out internal movements (transfers between users, transfer
    -- rollbacks). Transfers don't create new trust — they just move
    -- existing supply from one wallet to another — so counting them
    -- as "issued" would over-state the figure.
    --
    -- Spend entries are NEGATIVE so they're naturally excluded by the
    -- `amount > 0` filter; no type filter needed for them.
    SELECT
      COALESCE(SUM(amount) FILTER (
        WHERE amount > 0
          AND type NOT IN (
            'transfer_received',
            'transfer_sent',
            'transfer_rollback'
          )
      ), 0)::bigint AS gross_issued,
      -- Net ledger — should equal SUM(trust_balances.balance) after
      -- reconcile. Exposed in the response for drift monitoring.
      COALESCE(SUM(amount), 0)::bigint AS ledger_net,
      COUNT(*)::bigint AS ledger_entries
    FROM public.trust_ledger
  ),
  balance_stats AS (
    SELECT
      COALESCE(SUM(balance), 0)::bigint AS current_balance_sum,
      COUNT(*) FILTER (WHERE balance > 0)::bigint AS members_holding
    FROM public.trust_balances
  )
  SELECT jsonb_build_object(
    -- total_issued is the authoritative "ever minted" number. We
    -- clamp with GREATEST(gross_issued, current_balance_sum) so the
    -- hard invariant circulation <= total_issued holds even if
    -- the two source tables somehow disagree (e.g. on a project
    -- that hasn't run the reconcile migration yet). The UI can
    -- trust the response without a second check.
    'total_issued',    GREATEST(ls.gross_issued, bs.current_balance_sum),
    -- in_circulation is the authoritative "currently held" figure,
    -- read directly from trust_balances.balance.
    'in_circulation',  bs.current_balance_sum,
    -- Diagnostic values used by the reconciliation endpoint.
    'ledger_net',      ls.ledger_net,
    'ledger_entries',  ls.ledger_entries,
    'members_holding', bs.members_holding,
    'computed_at',     to_jsonb(now())
  )
  FROM ledger_stats ls, balance_stats bs;
$$;

GRANT EXECUTE ON FUNCTION public.trust_stats() TO authenticated, anon;

-- ── 2. One-time lifetime backfill ───────────────────────────────────────────
-- Recompute every user's trust_balances.lifetime column from the
-- authoritative ledger. The formula is:
--
--   lifetime = SUM(GREATEST(trust_ledger.amount, 0))
--
-- which is identical to what issue_trust() applies on every new
-- call. After this backfill runs, SUM(lifetime) across all users
-- equals the sum of every positive ledger entry — the ledger and
-- the cache agree.
--
-- Note: this only touches the `lifetime` column. The drift trigger
-- installed in 20260415000003 guards against UPDATE of `balance`
-- without the bypass flag, but it does NOT guard `lifetime`, so
-- this UPDATE runs without any flag gymnastics.
DO $$
DECLARE
  v_corrected integer := 0;
  v_orphan    integer := 0;
BEGIN
  -- Fix existing rows whose lifetime has drifted from the ledger.
  WITH correct_lifetime AS (
    SELECT
      tl.user_id,
      SUM(GREATEST(tl.amount, 0))::integer AS lifetime_correct
    FROM public.trust_ledger tl
    GROUP BY tl.user_id
  )
  UPDATE public.trust_balances tb
    SET lifetime = cl.lifetime_correct,
        updated_at = now()
    FROM correct_lifetime cl
    WHERE tb.user_id = cl.user_id
      AND tb.lifetime IS DISTINCT FROM cl.lifetime_correct;

  GET DIAGNOSTICS v_corrected = ROW_COUNT;

  -- Count any users who have ledger entries but no balance row.
  -- These are handled by reconcile_trust_balances() in the prior
  -- migration — emitted as a NOTICE here for visibility.
  SELECT COUNT(DISTINCT tl.user_id) INTO v_orphan
  FROM public.trust_ledger tl
  LEFT JOIN public.trust_balances tb ON tb.user_id = tl.user_id
  WHERE tb.user_id IS NULL;

  RAISE NOTICE 'TRUST LIFETIME BACKFILL: corrected % users, % orphans need reconcile_trust_balances()',
    v_corrected, v_orphan;
END $$;

-- ── 3. Stats snapshot (before/after NOTICE) ─────────────────────────────────
-- Emit the new RPC's output at migration apply time so `supabase db
-- push` shows the operator the fixed numbers. Helpful for verifying
-- the fix landed on the live DB.
DO $$
DECLARE
  v_stats jsonb;
BEGIN
  v_stats := public.trust_stats();
  RAISE NOTICE 'TRUST STATS AFTER FIX: %', v_stats::text;
END $$;

-- ── 4. PostgREST schema cache reload ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
