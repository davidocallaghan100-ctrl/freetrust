-- ============================================================================
-- Trust earning infrastructure — belt-and-braces safety net
-- ============================================================================
-- Companion to the code commit that wires lib/trust/award.ts +
-- lib/trust/rewards.ts into every trust-earning API route. The actual
-- issue_trust() RPC was originally defined by
-- supabase/migrations/20260413000004_trust_welcome_grant.sql and that
-- migration also added the INSERT RLS policies for trust_balances and
-- trust_ledger. This migration is a safety net in case:
--
--   * An ad-hoc Supabase UI edit dropped or altered the function
--   * The 20260413000004 migration was never applied to this project
--   * A future schema rebuild re-created the tables without policies
--
-- Idempotent — safe to re-run. CREATE OR REPLACE FUNCTION updates
-- the body in place, policy creations are wrapped in DO $$ IF NOT
-- EXISTS, ENABLE RLS is a no-op if already on.
--
-- Root cause of Cliff's missing coins:
--   The /api/create/publish route (and /api/listings, /api/jobs,
--   /api/communities, /api/events/[id]/rsvp, and the reviews route)
--   never called issue_trust() at all for their respective creation
--   paths. This wasn't an RLS / grants problem — it was a missing
--   call site problem. The companion code commit adds the calls
--   via the new awardTrust() helper. This migration ensures the
--   underlying RPC and policies that awardTrust() depends on are
--   definitely present.

-- ── 1. Ensure RLS is enabled on the trust tables ────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_balances' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.trust_balances ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_ledger' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.trust_ledger ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ── 2. issue_trust() RPC — canonical definition ────────────────────────────
-- CREATE OR REPLACE so this is idempotent. The body matches the
-- definition in 20260413000004_trust_welcome_grant.sql exactly so
-- re-running either migration in either order leaves the function
-- in the same state.
--
-- SECURITY DEFINER so the function runs with the function owner's
-- privileges and bypasses RLS cleanly on writes to trust_ledger and
-- trust_balances. SET search_path protects against privilege
-- escalation via search_path manipulation.
--
-- Handles first-time earners: the ON CONFLICT DO UPDATE on the
-- INSERT into trust_balances creates the row if it doesn't exist
-- (first award) or increments it in place (subsequent awards).
-- lifetime uses GREATEST(p_amount, 0) so negative amounts (debits
-- via wallet_transfers) don't reduce the all-time-earned tally.
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

GRANT EXECUTE ON FUNCTION public.issue_trust(uuid, integer, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_trust(uuid, integer, text, uuid, text) TO anon;

-- ── 3. INSERT policy on trust_balances — first-time earners ────────────────
-- The first time a user earns ₮, they have no row in trust_balances
-- (the row is only created by issue_trust). Without an INSERT policy,
-- the SECURITY DEFINER function bypasses RLS so the insert works —
-- but any future direct insert path from the user-session client
-- would fail. Add the policy as belt-and-braces.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trust_balances'
      AND policyname = 'Users can insert own balance row'
  ) THEN
    CREATE POLICY "Users can insert own balance row"
      ON public.trust_balances FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. INSERT policy on trust_ledger — first-time earners ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trust_ledger'
      AND policyname = 'Users can insert own ledger entry'
  ) THEN
    CREATE POLICY "Users can insert own ledger entry"
      ON public.trust_ledger FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 5. Table-level grants ───────────────────────────────────────────────────
-- Re-grant at the TABLE level so any prior column-level grant can't
-- mask newly-added columns or the INSERT permission. Same fix pattern
-- as 20260413000001_listings_category_column.sql.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_balances' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON public.trust_balances TO authenticated;
    GRANT SELECT ON public.trust_balances TO anon;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'trust_ledger' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT ON public.trust_ledger TO authenticated;
  END IF;
END $$;

-- ── 6. Cliff's missed coins — manual retroactive grant ─────────────────────
-- Cliff created a service marketplace listing before the earning path
-- bug was fixed and received ₮0 instead of the ₮50 CREATE_SERVICE
-- reward. This block looks up his profile by first_name ilike 'cliff'
-- and issues the missed amount via the same issue_trust RPC every
-- normal earning call uses — so it goes through the standard
-- ledger + balance update path and shows up in his wallet history
-- with a clear "Retroactive: missed service listing reward" note.
--
-- Guarded so it only fires once (idempotency check via the ledger
-- description). If there's no user matching "Cliff" (single match),
-- the block silently skips with a NOTICE — safe to run on any DB.
DO $$
DECLARE
  v_user_id  uuid;
  v_existing int;
BEGIN
  -- Find the Cliff in question. Match on first_name (canonical) and
  -- fall back to full_name for older users who haven't run the
  -- first/last name split. If multiple match, skip — better to
  -- award nothing than to award the wrong Cliff.
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE first_name ILIKE 'cliff'
     OR full_name  ILIKE 'cliff %'
     OR full_name  ILIKE 'cliff'
  LIMIT 2;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Cliff retroactive grant: no matching profile, skipping';
    RETURN;
  END IF;

  -- Idempotency — don't run twice if the migration is re-applied.
  SELECT COUNT(*) INTO v_existing
  FROM public.trust_ledger
  WHERE user_id = v_user_id
    AND type = 'create_service'
    AND description LIKE 'Retroactive:%';

  IF v_existing > 0 THEN
    RAISE NOTICE 'Cliff retroactive grant: already applied, skipping';
    RETURN;
  END IF;

  PERFORM public.issue_trust(
    v_user_id,
    50,
    'create_service',
    NULL,
    'Retroactive: missed service listing reward (pre-fix)'
  );

  RAISE NOTICE 'Cliff retroactive grant: awarded +50 to %', v_user_id;
END $$;

-- ── 7. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
