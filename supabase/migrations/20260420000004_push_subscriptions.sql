-- Migration: 20260420000004_push_subscriptions.sql
-- Stores Web Push VAPID subscriptions for delivery notifications.
-- Uses self-managed web-push npm package (GDPR compliant, no vendor lock-in).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,   -- DH public key for encryption
  auth_key    text NOT NULL,   -- auth secret for encryption
  user_agent  text,            -- browser/device info for debugging
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)   -- multi-device: one row per device per user
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can fully manage their own push subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;

NOTIFY pgrst, 'reload schema';
