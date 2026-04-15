-- ============================================================================
-- Signup bonus backfill — fix ₮25 → ₮200 drift for existing members
-- ============================================================================
-- Live bug: most existing FreeTrust users had a trust balance of only
-- ₮25 despite the product spec (and lib/trust/rewards.ts, and the
-- homepage hero) advertising a ₮200 welcome bonus. Root cause: the
-- `p_amount` values in /api/auth/signup-bonus/route.ts and
-- /app/auth/callback/route.ts were still hardcoded to `25` — the
-- constant introduced in the Cliff audit commit was never wired
-- into the signup paths. Every new user got 1/8th of what they
-- were promised.
--
-- The code fix (in the companion commit) switches every signup
-- call site to read TRUST_REWARDS.SIGNUP_BONUS (200) directly from
-- the central config. This migration backfills existing users.
--
-- Backfill logic:
--
--   Case A — user has an existing `signup_bonus` ledger entry:
--     * At least one of those entries will be ≤ ₮25 (the stale
--       hardcoded amount).
--     * Top them up with a new `signup_bonus_topup` ledger entry
--       of exactly (200 - sum of existing signup_bonus entries),
--       so the total signup grant ends up at ₮200.
--     * The top-up uses a distinct type (`signup_bonus_topup`) so
--       the NOT EXISTS guard below can dedupe on re-runs without
--       colliding with the real `signup_bonus` entries.
--
--   Case B — user has NO `signup_bonus` ledger entry at all:
--     * They never received the bonus. Issue a full ₮200 via
--       issue_trust() using the normal `signup_bonus` type, so
--       their ledger history looks like any other correctly-signed-
--       up member. This is what the Mags retroactive grant block
--       in 20260414000009 already does for a single named user;
--       this migration generalises it to every affected profile.
--
--   Case C — user already has ≥ ₮200 in signup_bonus entries:
--     * Skipped. No top-up applied.
--
-- Idempotent — the Case A top-up uses a distinct ledger type
-- (`signup_bonus_topup`) guarded by a NOT EXISTS check, and the
-- Case B path uses the existing Cliff/Mags-style "no row yet"
-- guard. Safe to re-run.

-- ── 1. Pre-fix audit ────────────────────────────────────────────────────────
-- Count the three classes of users so the operator sees the scope
-- of the fix in the NOTICE output before anything is touched.
DO $$
DECLARE
  v_case_a integer; -- existing signup_bonus but < 200 total
  v_case_b integer; -- no signup_bonus entry at all (but have a balance row)
  v_case_c integer; -- already at or above 200
  v_no_balance integer;
BEGIN
  SELECT COUNT(*) INTO v_case_a
  FROM (
    SELECT tl.user_id, SUM(tl.amount) AS grant_total
    FROM public.trust_ledger tl
    WHERE tl.type = 'signup_bonus'
    GROUP BY tl.user_id
    HAVING SUM(tl.amount) < 200
  ) q;

  SELECT COUNT(DISTINCT p.id) INTO v_case_b
  FROM public.profiles p
  JOIN public.trust_balances tb ON tb.user_id = p.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.trust_ledger tl
    WHERE tl.user_id = p.id AND tl.type = 'signup_bonus'
  );

  SELECT COUNT(*) INTO v_case_c
  FROM (
    SELECT tl.user_id, SUM(tl.amount) AS grant_total
    FROM public.trust_ledger tl
    WHERE tl.type = 'signup_bonus'
    GROUP BY tl.user_id
    HAVING SUM(tl.amount) >= 200
  ) q;

  SELECT COUNT(*) INTO v_no_balance
  FROM public.profiles p
  LEFT JOIN public.trust_balances tb ON tb.user_id = p.id
  WHERE tb.user_id IS NULL;

  RAISE NOTICE 'SIGNUP BONUS BACKFILL PRE-FIX:';
  RAISE NOTICE '  case A (existing signup_bonus, under-funded): %', v_case_a;
  RAISE NOTICE '  case B (no signup_bonus entry at all):         %', v_case_b;
  RAISE NOTICE '  case C (already at or above ₮200):             %', v_case_c;
  RAISE NOTICE '  profiles with NO trust_balances row:           %', v_no_balance;
END $$;

-- ── 2. Case A — top up users with existing under-funded signup_bonus ────────
-- For every user whose total `signup_bonus` ledger entries sum to
-- less than 200, issue an additional top-up so the total reaches
-- exactly 200. The top-up ledger entry uses type
-- `signup_bonus_topup` so it's clearly distinguished from the
-- original (stale) signup_bonus entries in audit logs and doesn't
-- conflict with the dedup check in /api/auth/signup-bonus or
-- /app/auth/callback (both of those check for the original
-- `signup_bonus` type, not `signup_bonus_topup`).
DO $$
DECLARE
  rec RECORD;
  v_topup integer;
  v_count integer := 0;
  v_total integer := 0;
BEGIN
  FOR rec IN
    SELECT tl.user_id, SUM(tl.amount)::integer AS grant_total
    FROM public.trust_ledger tl
    WHERE tl.type = 'signup_bonus'
    GROUP BY tl.user_id
    HAVING SUM(tl.amount) < 200
  LOOP
    -- Skip if a top-up has already been applied on a prior run of
    -- this migration. Idempotency guard.
    IF EXISTS (
      SELECT 1 FROM public.trust_ledger tl2
      WHERE tl2.user_id = rec.user_id
        AND tl2.type = 'signup_bonus_topup'
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
      'Signup bonus top-up — corrected from ₮' || rec.grant_total || ' to ₮200 (audit 2026-04-15)'
    );

    v_count := v_count + 1;
    v_total := v_total + v_topup;
  END LOOP;

  RAISE NOTICE 'SIGNUP BONUS BACKFILL CASE A: topped up % users (+₮% total)', v_count, v_total;
END $$;

-- ── 3. Case B — issue full ₮200 for users with no signup_bonus entry ────────
-- These users exist in profiles (and have some trust_balances row)
-- but their ledger has NO row of type 'signup_bonus'. They never
-- received the bonus at all — issue the full 200 via issue_trust()
-- using the canonical `signup_bonus` type so their ledger looks
-- identical to a correctly-signed-up member.
DO $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT DISTINCT p.id AS user_id
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trust_ledger tl
      WHERE tl.user_id = p.id AND tl.type = 'signup_bonus'
    )
  LOOP
    -- Belt-and-braces: also skip if they already have a top-up row
    -- (would indicate a prior Case A run where the case-class
    -- classification has since changed — e.g. the operator manually
    -- inserted the missing signup_bonus after Case A ran).
    IF EXISTS (
      SELECT 1 FROM public.trust_ledger tl2
      WHERE tl2.user_id = rec.user_id
        AND tl2.type IN ('signup_bonus', 'signup_bonus_topup')
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public.issue_trust(
      rec.user_id,
      200,
      'signup_bonus',
      NULL,
      'Retroactive signup bonus — missed at registration (audit 2026-04-15)'
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'SIGNUP BONUS BACKFILL CASE B: issued full ₮200 to % users', v_count;
END $$;

-- ── 4. Post-fix audit ───────────────────────────────────────────────────────
-- After both backfill passes, every user with a profile row should
-- have a total signup grant (signup_bonus + signup_bonus_topup) of
-- at least ₮200. This block emits a count of any remaining
-- stragglers so the operator can spot-check.
DO $$
DECLARE
  v_below_200 integer;
  v_missing integer;
BEGIN
  SELECT COUNT(*) INTO v_below_200
  FROM (
    SELECT tl.user_id, SUM(tl.amount) AS grant_total
    FROM public.trust_ledger tl
    WHERE tl.type IN ('signup_bonus', 'signup_bonus_topup')
    GROUP BY tl.user_id
    HAVING SUM(tl.amount) < 200
  ) q;

  SELECT COUNT(DISTINCT p.id) INTO v_missing
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.trust_ledger tl
    WHERE tl.user_id = p.id
      AND tl.type IN ('signup_bonus', 'signup_bonus_topup')
  );

  RAISE NOTICE 'SIGNUP BONUS BACKFILL POST-FIX:';
  RAISE NOTICE '  users still under ₮200:           %  (should be 0)', v_below_200;
  RAISE NOTICE '  profiles with NO signup grant:    %  (should be 0)', v_missing;
END $$;

-- ── 5. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
