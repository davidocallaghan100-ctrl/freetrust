-- ============================================================================
-- Signup bonus backfill — ₮25 → ₮200 correction for every existing user
-- ============================================================================
-- Fixes the production bug where new members received ₮25 on signup
-- instead of ₮200. Root cause (code): app/api/auth/signup-bonus/route.ts
-- and app/auth/callback/route.ts had `25` hardcoded in ~10 places
-- even though lib/trust/rewards.ts set SIGNUP_BONUS to 200. The code
-- fix in the same commit (feat: TRUST_REWARDS import + case A/B/C
-- idempotency) stops NEW signups from getting the wrong amount.
-- This migration cleans up every EXISTING user who got ₮25.
--
-- Two backfill cases:
--
--   CASE A — user has a signup_bonus ledger row but the total across
--            signup_bonus + signup_bonus_topup is < ₮200. Issue the
--            difference via issue_trust() as a 'signup_bonus_topup'
--            ledger entry so the audit trail shows: original grant
--            + top-up = ₮200. Idempotent — skips users who already
--            have a top-up row.
--
--   CASE B — user has a profiles row but NO signup_bonus (or topup)
--            ledger row at all. They missed the grant entirely
--            (likely because an older version of the flow crashed
--            after creating the profile but before issuing trust).
--            Issue the full ₮200 retroactively.
--
-- Post-fix verification query is included at the end so a
-- `supabase migration apply` run surfaces "correctly_funded vs
-- still_underfunded" in the output.
--
-- Safe to re-run — both DO blocks guard against double-backfill.

-- ── CASE A: top up users whose signup grant total is < ₮200 ────────────────
DO $$
DECLARE
  rec RECORD;
  v_topup integer;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT tl.user_id,
           SUM(tl.amount)::integer AS grant_total
      FROM public.trust_ledger tl
     WHERE tl.type = 'signup_bonus'
     GROUP BY tl.user_id
    HAVING SUM(tl.amount) < 200
  LOOP
    -- Idempotency guard: if a topup already exists, skip so re-runs
    -- don't stack more topups.
    IF EXISTS (
      SELECT 1
        FROM public.trust_ledger
       WHERE user_id = rec.user_id
         AND type    = 'signup_bonus_topup'
    ) THEN
      CONTINUE;
    END IF;

    v_topup := 200 - rec.grant_total;
    IF v_topup <= 0 THEN
      CONTINUE;
    END IF;

    PERFORM public.issue_trust(
      rec.user_id,
      v_topup,
      'signup_bonus_topup',
      NULL,
      'Signup bonus top-up — corrected from ₮' || rec.grant_total || ' to ₮200'
    );
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Case A: topped up % users to ₮200', v_count;
END $$;

-- ── CASE B: users with no signup_bonus entry at all ────────────────────────
-- These users slipped past the signup flow entirely and have NO
-- signup_bonus ledger row. Grant them the full ₮200 retroactively.
DO $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT DISTINCT p.id AS user_id
      FROM public.profiles p
     WHERE NOT EXISTS (
             SELECT 1
               FROM public.trust_ledger tl
              WHERE tl.user_id = p.id
                AND tl.type IN ('signup_bonus', 'signup_bonus_topup')
           )
  LOOP
    PERFORM public.issue_trust(
      rec.user_id,
      200,
      'signup_bonus',
      NULL,
      'Retroactive signup bonus — missed at registration'
    );
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Case B: issued full ₮200 to % users with no signup bonus', v_count;
END $$;

-- ── Verification ────────────────────────────────────────────────────────────
-- These SELECTs run during the migration and their results show up
-- in the migration output (Supabase CLI / Dashboard) so the operator
-- can immediately see whether the fix landed everyone at ₮200.
DO $$
DECLARE
  v_correct    integer;
  v_under      integer;
  v_min_total  integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE total >= 200),
    COUNT(*) FILTER (WHERE total <  200),
    COALESCE(MIN(total), 0)
    INTO v_correct, v_under, v_min_total
    FROM (
      SELECT user_id, SUM(amount)::integer AS total
        FROM public.trust_ledger
       WHERE type IN ('signup_bonus', 'signup_bonus_topup')
       GROUP BY user_id
    ) q;

  RAISE NOTICE
    'Verification: % users at ≥₮200, % users still under ₮200, min signup total = ₮%',
    v_correct, v_under, v_min_total;
END $$;

-- ── Reload PostgREST schema cache ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
