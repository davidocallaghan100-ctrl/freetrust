-- ============================================================================
-- Pending orders — buyers express interest when seller lacks Stripe
-- ============================================================================
-- When a buyer clicks "Request to buy" on a listing whose seller
-- hasn't connected Stripe, a pending_orders row is created. When the
-- seller completes Stripe onboarding, all their pending-order buyers
-- are notified so they can complete the real checkout.
--
-- Pending orders expire after 14 days. Expiry is lazy (set to
-- 'expired' on read) — no cron needed at current scale.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.pending_orders (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id            uuid        NOT NULL,
  listing_type          text        NOT NULL CHECK (listing_type IN ('service', 'product', 'rent_share')),
  listing_title         text        NOT NULL,
  listing_price_cents   integer     NOT NULL,
  listing_currency      text        NOT NULL DEFAULT 'EUR',
  message               text,
  status                text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'converted', 'cancelled', 'expired', 'declined')),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  converted_to_order_id uuid,
  UNIQUE (buyer_id, listing_id, status)
);

CREATE INDEX IF NOT EXISTS pending_orders_seller_id_idx
  ON public.pending_orders (seller_id);
CREATE INDEX IF NOT EXISTS pending_orders_buyer_id_idx
  ON public.pending_orders (buyer_id);
CREATE INDEX IF NOT EXISTS pending_orders_expires_at_idx
  ON public.pending_orders (expires_at) WHERE status = 'pending';

-- RLS
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers see own pending orders"              ON public.pending_orders;
DROP POLICY IF EXISTS "sellers see pending orders on their listings" ON public.pending_orders;
DROP POLICY IF EXISTS "buyers create pending orders"               ON public.pending_orders;
DROP POLICY IF EXISTS "buyers cancel own pending orders"           ON public.pending_orders;
DROP POLICY IF EXISTS "sellers decline pending orders"             ON public.pending_orders;

CREATE POLICY "buyers see own pending orders"
  ON public.pending_orders FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "sellers see pending orders on their listings"
  ON public.pending_orders FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "buyers create pending orders"
  ON public.pending_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "buyers cancel own pending orders"
  ON public.pending_orders FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id AND status IN ('cancelled'));

CREATE POLICY "sellers decline pending orders"
  ON public.pending_orders FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id AND status IN ('declined'));

GRANT SELECT, INSERT, UPDATE ON public.pending_orders TO authenticated;

NOTIFY pgrst, 'reload schema';
