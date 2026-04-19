-- Migration: 20260420000002_order_timeline.sql
-- Adds timestamped status history to orders and delivery deadline fields.
-- Each status_history entry: {"status": "paid", "timestamp": "2026-04-19T10:00:00Z", "actor_id": "uuid"}

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Set when seller confirms the order, based on listing delivery_days promise
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS expected_delivery_at timestamptz;

-- How many days seller promises to deliver within (shown on listing, copied to order)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS delivery_days integer;

NOTIFY pgrst, 'reload schema';
