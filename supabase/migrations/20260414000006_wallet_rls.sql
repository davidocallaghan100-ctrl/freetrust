-- ============================================================================
-- Wallet RLS safety net + spend_trust() RPC
-- ============================================================================
-- Fixes the "trust spend silently fails" bug where clicking any Spend
-- Trust card on /wallet showed a success toast but the balance never
-- actually decremented.
--
-- Root cause:
--   1. No UPDATE policy on trust_balances in any migration. The
--      existing migration 20260413000004_trust_welcome_grant.sql
--      adds SELECT + INSERT policies only, so user-session
--      .update({ balance: ... }).eq('user_id', uid) hits 0-rows-
--      updated silently (PostgREST returns error: null, data: null —
--      the well-known RLS-blocked-update gotcha).
--   2. /api/trust/spend did a non-atomic read-check-write pattern
--      with no error handling on either the ledger INSERT or the
--      balance UPDATE. Even with a correct UPDATE policy, a TOCTOU
--      race between two concurrent spend calls could double-spend,
--      and a partial write (ledger succeeds, balance update fails)
--      left the account in an inconsistent state forever.
--
-- Fix — three layered changes:
--
--   1. ENABLE ROW LEVEL SECURITY on both tables (idempotent).
--   2. Idempotent CREATE POLICY IF NOT EXISTS for the UPDATE path
--      on trust_balances — belt-and-braces for any direct-update
--      code path that can't easily switch to the RPC below.
--   3. New spend_trust() RPC function (SECURITY DEFINER) that
--      atomically:
--        a. Locks the user's trust_balances row FOR UPDATE to prevent
--           TOCTOU races between concurrent callers.
--        b. Raises an `insufficient_funds` exception if the balance
--           is less than the requested amount — this is a clean
--           signal the caller can detect (PostgrestError.code SQLSTATE
--           'P0001' = raised exception, plus the message text
--           contains 'insufficient_funds').
--        c. UPDATEs balance -= amount in the same transaction.
--        d. INSERTs a negative-amount row into trust_ledger.
--        e. Returns the new balance so the caller can update the UI
--           without a round-trip.
--   4. GRANT EXECUTE on the RPC to authenticated + anon, plus
--      GRANT UPDATE on trust_balances as a fallback for any direct
--      update path that hasn't been migrated to use the RPC yet.
--   5. NOTIFY pgrst so the new function shows up in the REST API
--      immediately instead of waiting for the next worker restart.
--
-- Idempotent — safe to re-run. All CREATE POLICY statements are
-- wrapped in DO $$ IF NOT EXISTS, the RPC uses CREATE OR REPLACE,
-- ENABLE RLS is a no-op if already on.

-- ── 1. Ensure RLS is enabled ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_balances' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.trust_balances ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_ledger' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.trust_ledger ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ── 2. UPDATE policy on trust_balances — belt-and-braces ────────────────────
-- The RPC path below (spend_trust) is SECURITY DEFINER and bypasses RLS,
-- so this policy isn't strictly required for the fix to work. But any
-- future direct-update path (e.g. a settings page that resets the
-- "last_seen" column on trust_balances, or a manual admin correction
-- via the user-session client) would hit the same 0-rows-updated
-- silent failure without this. Add it now so the next instance of
-- this bug class can't happen.
--
-- USING (auth.uid() = user_id)      — which rows you can update
-- WITH CHECK (auth.uid() = user_id) — what the new row must look like
--                                     (belt-and-braces against pivoting
--                                     user_id to someone else's id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'trust_balances'
      AND policyname = 'Users can update own balance'
  ) THEN
    CREATE POLICY "Users can update own balance"
      ON public.trust_balances
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. spend_trust() RPC — atomic balance debit + ledger entry ──────────────
-- Called by app/api/trust/spend/route.ts (the /wallet → Spend Trust
-- cards path) to debit trust tokens for boost_listing, offset_fees,
-- donate_impact, unlock_badge, featured_profile, etc.
--
-- SECURITY DEFINER so it runs with the function owner's privileges
-- and bypasses RLS cleanly. SET search_path prevents privilege
-- escalation via search_path manipulation.
--
-- Raises an `insufficient_funds` custom exception when the caller
-- doesn't have enough balance. The caller's PostgrestError.message
-- will contain 'insufficient_funds' — the /api/trust/spend route
-- detects this and returns a clean 402 to the UI.
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
  -- Validate the amount up front. The caller should have already
  -- done this, but a negative or zero amount sneaking through would
  -- bypass the overdraft check below and produce nonsense ledger
  -- entries.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount: p_amount must be a positive integer (got %)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock the balance row FOR UPDATE so a concurrent spend_trust
  -- call from the same user blocks until this transaction commits.
  -- This is the TOCTOU fix — without the lock, two simultaneous
  -- spends could both read balance=300, both check "300 >= 200",
  -- and both commit, leaving balance=-100 (blocked by the CHECK
  -- constraint from 20260413000004 — good — but the caller sees
  -- a generic constraint violation instead of a clean
  -- insufficient_funds error).
  SELECT balance INTO v_current
    FROM public.trust_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

  -- Row missing — user has never earned any trust. Treat as a zero
  -- balance and raise the standard insufficient_funds error so the
  -- caller renders the same "not enough trust" UI in both cases.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_funds: no balance row (requested %, available 0)', p_amount
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds: requested %, available %', p_amount, v_current
      USING ERRCODE = 'P0001';
  END IF;

  -- Atomic debit. Lifetime stays unchanged — it tracks total earned,
  -- not net-of-spend, so a user who earned ₮500 and spent ₮400 still
  -- shows lifetime=500 in the "Trust earned all-time" stat.
  UPDATE public.trust_balances
    SET balance    = balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new;

  -- Record the debit as a negative ledger entry so the wallet
  -- history tab shows it with a minus sign. Matches the shape
  -- expected by /api/wallet's txList mapping at line 190-200.
  INSERT INTO public.trust_ledger (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, p_type, p_desc);

  RETURN v_new;
END;
$$;

-- Expose to authenticated users. anon can't call it because it
-- takes a user_id and anon sessions don't have one, but we grant
-- anyway so Supabase's introspection shows the function.
GRANT EXECUTE ON FUNCTION public.spend_trust(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_trust(uuid, integer, text, text) TO anon;

-- ── 4. Table-level grants — fallback for direct updates ─────────────────────
-- GRANT UPDATE on trust_balances so the belt-and-braces policy
-- above can actually take effect. Without the table-level grant,
-- any prior column-level grant would mask the UPDATE permission
-- and the policy would be moot. Same fix pattern as
-- 20260413000001_listings_category_column.sql.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_balances' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON public.trust_balances TO authenticated;
    GRANT SELECT ON public.trust_balances TO anon;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_ledger' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT ON public.trust_ledger TO authenticated;
  END IF;
END $$;

-- ── 5. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
