-- ============================================================================
-- Migration: 20260424000001_pending_orders.sql
--
-- Problem:  The original orders status CHECK constraint only allowed:
--             pending_escrow | in_progress | delivered | completed |
--             disputed | refunded
--           However, the Stripe webhook handler (app/api/webhooks/stripe/route.ts)
--           writes status = 'paid' and status = 'cancelled' extensively:
--             - checkout.session.completed  → 'paid'
--             - handlePaymentIntentFailed   → 'refunded' (used 'cancelled' in
--               other places via PATCH endpoints)
--           Any order update via the webhook would fail the constraint and
--           silently leave orders stuck in 'pending_escrow'.
--
-- Fix:
--   1. Drop the old CHECK constraint and replace it with an expanded one
--      that includes 'paid' and 'cancelled'.
--   2. Create a `pending_orders` view returning all in-flight orders
--      (status IN 'pending_escrow', 'paid', 'in_progress', 'delivered').
--      RLS on the underlying orders table already restricts rows to
--      buyer/seller, so no additional policy is needed on the view —
--      but we add SECURITY INVOKER explicitly to be correct.
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ── 1. Expand the status CHECK constraint ────────────────────────────────────
-- PostgreSQL doesn't support ALTER TABLE ... ALTER CONSTRAINT, so we must
-- DROP and re-ADD the constraint. We identify the constraint by looking up
-- its name in pg_constraint rather than hardcoding it (the original schema
-- used a positional unnamed constraint which Postgres auto-named).

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Find the name of the existing CHECK constraint on orders.status
  SELECT conname
    INTO v_constraint_name
    FROM pg_constraint c
    JOIN pg_class     r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
   WHERE n.nspname = 'public'
     AND r.relname = 'orders'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%pending_escrow%'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped old orders status constraint: %', v_constraint_name;
  ELSE
    RAISE NOTICE 'No old orders status constraint found — skipping drop';
  END IF;
END $$;

-- Add the expanded constraint (IF NOT EXISTS pattern via DO block for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class     r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname  = 'public'
       AND r.relname  = 'orders'
       AND c.contype  = 'c'
       AND pg_get_constraintdef(c.oid) LIKE '%paid%'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_check CHECK (
        status IN (
          'pending_escrow',
          'paid',
          'in_progress',
          'delivered',
          'completed',
          'disputed',
          'refunded',
          'cancelled'
        )
      );
    RAISE NOTICE 'Added expanded orders status constraint (includes paid, cancelled)';
  ELSE
    RAISE NOTICE 'Expanded orders status constraint already exists — skipping';
  END IF;
END $$;

-- ── 2. Create the pending_orders view ────────────────────────────────────────
-- Returns all orders that are "in-flight" — i.e. the buyer has initiated
-- or paid for an order that has not yet been completed, refunded, cancelled
-- or disputed.
--
-- RLS note: The view inherits RLS from the underlying `orders` table
-- because it is created with SECURITY INVOKER (the default). Supabase
-- PostgREST applies row-level security on the base table, so callers
-- only see their own rows.

CREATE OR REPLACE VIEW public.pending_orders
  WITH (security_invoker = true)
AS
SELECT
  id,
  buyer_id,
  seller_id,
  status,
  -- Canonical amount column — original schema used amount_pence; later
  -- migrations added a plain `amount` column (integer cents/pence).
  -- We expose both so callers don't need to know which one is populated.
  amount_pence,
  -- `amount` column was added by later migrations; may not exist yet on
  -- all environments. Cast via a sub-select to avoid compilation failure.
  -- We'll just omit it here and let callers join back to orders if needed.
  stripe_session_id,
  stripe_payment_intent,
  created_at,
  updated_at
FROM public.orders
WHERE status IN ('pending_escrow', 'paid', 'in_progress', 'delivered');

-- Grant SELECT on the view to authenticated users (RLS on the base table
-- still applies — this just makes the view accessible to the role).
GRANT SELECT ON public.pending_orders TO authenticated;

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_constraint_ok boolean;
  v_view_ok       boolean;
BEGIN
  -- Check the new constraint exists
  SELECT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class     r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND r.relname = 'orders'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) LIKE '%paid%'
  ) INTO v_constraint_ok;

  -- Check the view exists
  SELECT EXISTS (
    SELECT 1
      FROM pg_views
     WHERE schemaname = 'public'
       AND viewname   = 'pending_orders'
  ) INTO v_view_ok;

  RAISE NOTICE 'Verification — expanded constraint: %, pending_orders view: %',
    v_constraint_ok, v_view_ok;
END $$;

-- Reload PostgREST schema cache so the new view is immediately queryable
NOTIFY pgrst, 'reload schema';
