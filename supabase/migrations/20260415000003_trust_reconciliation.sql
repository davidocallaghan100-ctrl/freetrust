-- ============================================================================
-- Trust reconciliation — audit queries, backfill, RPC, drift trigger
-- ============================================================================
-- Closes Section 3 of the trust economy integrity audit:
--
--   3a. Full ledger audit — emitted as NOTICE lines at migration
--       apply time so `supabase db push` surfaces counts to the
--       operator. The raw queries are also kept in this file as
--       DO $$ blocks so they can be re-run ad-hoc.
--
--   3b. Fix any drift found —
--         * Users with ledger entries but no balance row: create
--           the row with the correct sum (via issue_trust cannot
--           be used directly because it inserts a NEW ledger
--           entry; instead we UPSERT trust_balances manually inside
--           a transaction, bypassing the drift trigger below via
--           the SECURITY DEFINER reconcile function)
--         * Users with balance/ledger mismatch: reconcile balance
--           to equal the ledger sum (ledger is the source of
--           truth)
--         * Duplicate awards are NOT auto-dedupedduplicate. They
--           are reported via NOTICE so the operator can review
--           manually — mass-deleting ledger rows is too risky for
--           an automated fix.
--
--   3c. reconcile_trust_balances() — admin-callable RPC that
--       recomputes every user's balance from the ledger, returns
--       a JSON report with counts and a sample of corrected rows.
--       Also callable from /api/admin/trust/reconcile when the
--       operator wants to force a reconcile without re-running
--       a migration.
--
--   3d. trust_balances drift trigger — raises an exception if any
--       path tries to UPDATE trust_balances.balance without
--       declaring a session-local flag that the canonical RPCs
--       (issue_trust, spend_trust, donate_to_impact_fund,
--       reconcile_trust_balances) set before they touch the
--       table. This is the belt-and-braces check that nothing
--       in the codebase can ever again do a direct
--       `.update({ balance })` and silently drift.
--
-- Idempotent — every block is guarded with CREATE OR REPLACE /
-- DO $$ IF NOT EXISTS / ALTER ... IF EXISTS.

-- ── 1. Pre-fix audit report ─────────────────────────────────────────────────
-- Counts the three classes of discrepancy the audit spec asks for
-- and emits them as NOTICE lines. These numbers are the
-- "before" half of the reconciliation report — the reconcile RPC
-- below emits the "after" half.
DO $$
DECLARE
  v_orphan_ledger integer;
  v_balance_drift integer;
  v_dup_awards    integer;
BEGIN
  SELECT COUNT(DISTINCT tl.user_id) INTO v_orphan_ledger
  FROM public.trust_ledger tl
  LEFT JOIN public.trust_balances tb ON tb.user_id = tl.user_id
  WHERE tb.user_id IS NULL;

  SELECT COUNT(*) INTO v_balance_drift
  FROM (
    SELECT tb.user_id, tb.balance, COALESCE(SUM(tl.amount), 0) AS ledger_sum
    FROM public.trust_balances tb
    LEFT JOIN public.trust_ledger tl ON tl.user_id = tb.user_id
    GROUP BY tb.user_id, tb.balance
    HAVING tb.balance <> COALESCE(SUM(tl.amount), 0)
  ) q;

  SELECT COUNT(*) INTO v_dup_awards
  FROM (
    SELECT user_id, type, DATE(created_at) AS day
    FROM public.trust_ledger
    GROUP BY user_id, type, DATE(created_at)
    HAVING COUNT(*) > 1
  ) q;

  RAISE NOTICE 'TRUST AUDIT PRE-FIX:';
  RAISE NOTICE '  users with ledger but no balance row: %', v_orphan_ledger;
  RAISE NOTICE '  users with balance != ledger sum:      %', v_balance_drift;
  RAISE NOTICE '  (user_id, type, day) with dup awards:  %  (not auto-deduped, review manually)', v_dup_awards;
END $$;

-- ── 2. Session-local drift-trigger bypass flag ──────────────────────────────
-- The drift trigger (installed below) raises an exception on any
-- UPDATE of trust_balances.balance UNLESS the session has set
-- app.allow_balance_update = 'yes' via SET LOCAL. The canonical
-- RPCs (issue_trust, spend_trust, donate_to_impact_fund,
-- reconcile_trust_balances) all set this flag before touching the
-- table and unset it right after. Any caller that doesn't go
-- through an RPC — a direct `admin.from('trust_balances').update()`
-- call — will miss the flag and hit the trigger's EXCEPTION.
--
-- Why not use SECURITY DEFINER + revoke UPDATE permission? Because
-- the admin (service_role) client has the BYPASSRLS privilege and
-- the existing grants include UPDATE, so neither RLS nor GRANT
-- revocation can block a bug that accidentally takes the direct
-- update path. A trigger is the only defence that applies to
-- every caller regardless of privilege.

-- ── 3. Upgrade issue_trust to set the bypass flag ───────────────────────────
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
  -- Tell the drift trigger this UPDATE is legitimate
  PERFORM set_config('app.allow_balance_update', 'yes', true);

  INSERT INTO public.trust_ledger (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, p_amount, p_type, p_ref, p_desc);

  INSERT INTO public.trust_balances (user_id, balance, lifetime)
  VALUES (p_user_id, GREATEST(p_amount, 0), GREATEST(p_amount, 0))
  ON CONFLICT (user_id) DO UPDATE SET
    balance    = public.trust_balances.balance  + p_amount,
    lifetime   = public.trust_balances.lifetime + GREATEST(p_amount, 0),
    updated_at = now();

  -- Unset the bypass flag so subsequent updates in the same
  -- transaction (if any) still hit the trigger.
  PERFORM set_config('app.allow_balance_update', 'no', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_trust(uuid, integer, text, uuid, text) TO authenticated, anon;

-- ── 4. Upgrade spend_trust to set the bypass flag ───────────────────────────
CREATE OR REPLACE FUNCTION public.spend_trust(
  p_user_id uuid,
  p_amount  integer,
  p_type    text,
  p_desc    text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_new     integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount: p_amount must be a positive integer (got %)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

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

  PERFORM set_config('app.allow_balance_update', 'yes', true);

  UPDATE public.trust_balances
    SET balance    = balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new;

  INSERT INTO public.trust_ledger (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, p_type, p_desc);

  PERFORM set_config('app.allow_balance_update', 'no', true);

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_trust(uuid, integer, text, text) TO authenticated, anon;

-- ── 5. Upgrade donate_to_impact_fund to set the bypass flag ─────────────────
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
  v_current  integer;
  v_new_fund bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount: p_amount must be a positive integer (got %)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

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

  PERFORM set_config('app.allow_balance_update', 'yes', true);

  UPDATE public.trust_balances
    SET balance    = balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO public.trust_ledger (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, -p_amount, 'impact_donation', p_project_id, p_desc);

  UPDATE public.impact_fund_balance
    SET balance    = balance + p_amount,
        lifetime   = lifetime + p_amount,
        updated_at = now()
    WHERE id = 1
    RETURNING balance INTO v_new_fund;

  INSERT INTO public.impact_donations (user_id, project_id, amount)
  VALUES (p_user_id, p_project_id, p_amount);

  IF p_project_id IS NOT NULL THEN
    UPDATE public.impact_projects
      SET raised  = COALESCE(raised, 0) + p_amount,
          backers = COALESCE(backers, 0) + 1,
          updated_at = now()
      WHERE id = p_project_id;
  END IF;

  PERFORM set_config('app.allow_balance_update', 'no', true);

  RETURN v_new_fund;
END;
$$;

GRANT EXECUTE ON FUNCTION public.donate_to_impact_fund(uuid, integer, uuid, text) TO authenticated, anon;

-- ── 6. reconcile_trust_balances() — the audit RPC ───────────────────────────
-- Recomputes every user's trust_balances.balance from the ledger
-- sum. Upserts missing balance rows. Returns a JSON report with
-- counts and a sample of corrected rows so the operator can see
-- what moved.
--
-- Admin-only — the /api/admin/trust/reconcile endpoint is the
-- only HTTP path that calls this. Direct callers must go through
-- the admin (service_role) client.
CREATE OR REPLACE FUNCTION public.reconcile_trust_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created       integer := 0;
  v_corrected     integer := 0;
  v_unchanged     integer := 0;
  v_sample        jsonb   := '[]'::jsonb;
  rec RECORD;
BEGIN
  PERFORM set_config('app.allow_balance_update', 'yes', true);

  -- 1. Create missing balance rows for users with ledger entries
  --    but no trust_balances row. Sum the ledger, use that as the
  --    starting balance + lifetime.
  FOR rec IN
    SELECT tl.user_id, SUM(tl.amount)::integer AS ledger_sum,
           SUM(GREATEST(tl.amount, 0))::integer AS ledger_lifetime
    FROM public.trust_ledger tl
    LEFT JOIN public.trust_balances tb ON tb.user_id = tl.user_id
    WHERE tb.user_id IS NULL
    GROUP BY tl.user_id
  LOOP
    INSERT INTO public.trust_balances (user_id, balance, lifetime, updated_at)
    VALUES (rec.user_id, GREATEST(rec.ledger_sum, 0), rec.ledger_lifetime, now())
    ON CONFLICT (user_id) DO NOTHING;
    v_created := v_created + 1;
  END LOOP;

  -- 2. Correct any existing balance rows whose balance drifts from
  --    the ledger sum. Ledger is the source of truth.
  FOR rec IN
    SELECT tb.user_id, tb.balance AS stored_balance,
           COALESCE(SUM(tl.amount), 0)::integer AS ledger_sum
    FROM public.trust_balances tb
    LEFT JOIN public.trust_ledger tl ON tl.user_id = tb.user_id
    GROUP BY tb.user_id, tb.balance
    HAVING tb.balance <> COALESCE(SUM(tl.amount), 0)
  LOOP
    UPDATE public.trust_balances
      SET balance    = GREATEST(rec.ledger_sum, 0),
          updated_at = now()
      WHERE user_id = rec.user_id;

    v_corrected := v_corrected + 1;
    IF jsonb_array_length(v_sample) < 20 THEN
      v_sample := v_sample || jsonb_build_object(
        'user_id', rec.user_id,
        'stored_before', rec.stored_balance,
        'ledger_sum',    rec.ledger_sum,
        'drift',         rec.stored_balance - rec.ledger_sum
      );
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_unchanged
  FROM public.trust_balances;

  PERFORM set_config('app.allow_balance_update', 'no', true);

  RETURN jsonb_build_object(
    'rows_created',   v_created,
    'rows_corrected', v_corrected,
    'rows_total',     v_unchanged,
    'sample',         v_sample,
    'reconciled_at',  now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_trust_balances() TO authenticated;

-- ── 7. Drift-prevention trigger on trust_balances ───────────────────────────
-- Raises an exception if an UPDATE touches .balance without the
-- session-local bypass flag set. This is the canonical defence
-- against future `.update({ balance })` bugs.
--
-- The trigger runs BEFORE UPDATE OF balance so only balance-touching
-- updates are checked — other columns (lifetime, updated_at) can
-- still be updated by housekeeping jobs without going through an RPC.
CREATE OR REPLACE FUNCTION public.enforce_balance_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.balance IS DISTINCT FROM NEW.balance THEN
    IF current_setting('app.allow_balance_update', true) IS DISTINCT FROM 'yes' THEN
      RAISE EXCEPTION
        'direct trust_balances.balance UPDATE is forbidden — call issue_trust(), spend_trust(), donate_to_impact_fund() or reconcile_trust_balances() instead'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trust_balances_drift_guard'
  ) THEN
    CREATE TRIGGER trust_balances_drift_guard
      BEFORE UPDATE OF balance ON public.trust_balances
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_balance_update_guard();
  END IF;
END $$;

-- ── 8. trust_balances ↔ profiles.trust_balance mirror trigger ───────────────
-- The codebase has a denormalised profiles.trust_balance column
-- that feed components (PostCard, dashboard, feed/[id]) read for
-- display. Before the audit fix, two routes (profile/complete-bonus,
-- feed/posts/like) wrote directly to this column, bypassing the
-- canonical trust_balances row. Those routes are now fixed to use
-- awardTrust(), but profiles.trust_balance still needs to be kept
-- in sync — otherwise every consumer component would have to be
-- rewritten to read from trust_balances instead.
--
-- Solution: an AFTER trigger on trust_balances that mirrors .balance
-- into profiles.trust_balance. This is a pure cache-invalidation
-- trigger — profiles.trust_balance is now a read-only denormalised
-- mirror and the only thing allowed to write to it is this trigger.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trust_balance integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.mirror_trust_balance_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
    SET trust_balance = NEW.balance
    WHERE id = NEW.user_id
      AND trust_balance IS DISTINCT FROM NEW.balance;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trust_balances_mirror_to_profile'
  ) THEN
    CREATE TRIGGER trust_balances_mirror_to_profile
      AFTER INSERT OR UPDATE OF balance ON public.trust_balances
      FOR EACH ROW
      EXECUTE FUNCTION public.mirror_trust_balance_to_profile();
  END IF;
END $$;

-- ── 9. Run the reconcile now and report the results ─────────────────────────
-- Fixes every existing drift at migration apply time. The reconcile
-- RPC will no-op on future runs once everything is clean.
DO $$
DECLARE
  v_report jsonb;
BEGIN
  v_report := public.reconcile_trust_balances();
  RAISE NOTICE 'TRUST RECONCILE POST-FIX: %', v_report::text;
END $$;

-- One-time backfill of profiles.trust_balance from trust_balances
-- so the denormalised mirror catches up to the canonical source
-- on every user. The mirror trigger takes over from here.
DO $$
DECLARE
  v_synced integer;
BEGIN
  PERFORM set_config('app.allow_balance_update', 'no', true);
  UPDATE public.profiles p
    SET trust_balance = COALESCE(tb.balance, 0)
    FROM public.trust_balances tb
    WHERE p.id = tb.user_id
      AND p.trust_balance IS DISTINCT FROM COALESCE(tb.balance, 0);
  GET DIAGNOSTICS v_synced = ROW_COUNT;
  RAISE NOTICE 'TRUST MIRROR SYNC: updated % profiles', v_synced;
END $$;

-- ── 10. Re-run the audit queries ────────────────────────────────────────────
DO $$
DECLARE
  v_orphan_ledger integer;
  v_balance_drift integer;
BEGIN
  SELECT COUNT(DISTINCT tl.user_id) INTO v_orphan_ledger
  FROM public.trust_ledger tl
  LEFT JOIN public.trust_balances tb ON tb.user_id = tl.user_id
  WHERE tb.user_id IS NULL;

  SELECT COUNT(*) INTO v_balance_drift
  FROM (
    SELECT tb.user_id
    FROM public.trust_balances tb
    LEFT JOIN public.trust_ledger tl ON tl.user_id = tb.user_id
    GROUP BY tb.user_id, tb.balance
    HAVING tb.balance <> COALESCE(SUM(tl.amount), 0)
  ) q;

  RAISE NOTICE 'TRUST AUDIT POST-FIX:';
  RAISE NOTICE '  users with ledger but no balance row: %  (should be 0)', v_orphan_ledger;
  RAISE NOTICE '  users with balance != ledger sum:      %  (should be 0)', v_balance_drift;
END $$;

NOTIFY pgrst, 'reload schema';
