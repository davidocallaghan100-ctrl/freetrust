-- Migration: 20260420000003_delivery_sessions.sql
-- Creates the delivery_sessions table for Uber-style live GPS tracking.
-- Seller broadcasts their location via Supabase Realtime; buyer sees live map.

CREATE TABLE IF NOT EXISTS public.delivery_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session lifecycle
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,

  -- Buyer's delivery address (static, set when session starts from order)
  buyer_lat       double precision,
  buyer_lng       double precision,
  buyer_address   text,

  -- Last known seller position (fallback if realtime channel drops)
  last_seller_lat double precision,
  last_seller_lng double precision,
  last_ping_at    timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one active session per order at a time
CREATE UNIQUE INDEX IF NOT EXISTS delivery_sessions_order_active_idx
  ON public.delivery_sessions (order_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS delivery_sessions_order_id_idx
  ON public.delivery_sessions (order_id);

-- RLS
ALTER TABLE public.delivery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seller can insert delivery session"
  ON public.delivery_sessions FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Buyer and seller can view their session"
  ON public.delivery_sessions FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR buyer_id = auth.uid());

CREATE POLICY "Seller can update their session"
  ON public.delivery_sessions FOR UPDATE TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.delivery_sessions TO authenticated;

-- Add delivery address / geofence columns to orders
-- Captured at checkout so geofence notifications can compare seller pos vs buyer address
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_lat     double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng     double precision;

NOTIFY pgrst, 'reload schema';
