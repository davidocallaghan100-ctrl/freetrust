-- Migration: 20260421000002_delivery_sessions_metadata.sql
-- Adds a metadata jsonb column to delivery_sessions so the geofence API
-- can track which push notifications have already been sent (dedup flags)
-- without introducing extra tables.
--
-- Flags stored in metadata:
--   { "near_sent": true }   — "5 minutes away" push already sent (1 km threshold)
--   { "arrived_sent": true } — "Arrived" push already sent (100 m threshold)

ALTER TABLE public.delivery_sessions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

-- Track when we last nudged the buyer to confirm receipt, so we don't
-- spam multiple reminders for the same delivered order.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_nudged_at timestamptz;

NOTIFY pgrst, 'reload schema';
