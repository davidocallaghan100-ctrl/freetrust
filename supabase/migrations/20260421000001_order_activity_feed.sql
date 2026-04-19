-- Order Activity Feed
-- Shared real-time log of every significant event on an order
-- Visible to both buyer and seller. Powers the "single source of truth" view.

CREATE TABLE IF NOT EXISTS public.order_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role  text CHECK (actor_role IN ('buyer', 'seller', 'system')),
  event_type  text NOT NULL,
  -- event_type values: order_placed, payment_confirmed, seller_accepted,
  --   delivery_started, location_update, delivery_completed, buyer_confirmed,
  --   dispute_raised, dispute_resolved, review_left, message_sent, status_changed
  title       text NOT NULL,          -- short human-readable label e.g. "Payment confirmed"
  body        text,                   -- optional detail e.g. "Seller accepted within 2 hours"
  metadata    jsonb DEFAULT '{}'::jsonb,  -- flexible extra data
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_activity_order_id_idx ON public.order_activity (order_id, created_at DESC);

ALTER TABLE public.order_activity ENABLE ROW LEVEL SECURITY;

-- Both buyer and seller of an order can see its activity
CREATE POLICY "Buyer and seller can view order activity"
  ON public.order_activity FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_activity.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Authenticated users who are party to the order can insert (server inserts via service role)
CREATE POLICY "Service role can insert activity"
  ON public.order_activity FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_activity.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

GRANT SELECT, INSERT ON public.order_activity TO authenticated;

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_activity;

NOTIFY pgrst, 'reload schema';
