-- ============================================================================
-- Notifications bootstrap — table + RLS + realtime + insert helper
-- ============================================================================
-- The notifications schema previously lived ONLY in
-- lib/supabase/notifications-schema.sql, which is a one-time init file
-- that Supabase does not auto-apply. On any project where that file
-- was never manually run, the `notifications` table doesn't exist,
-- which means every `.from('notifications').insert(...)` call across
-- the codebase (messages, follows, reviews, orders, impact, referrals,
-- webhooks) silently no-ops — most call sites swallow the error in a
-- try/catch so nobody ever noticed.
--
-- This migration creates the table (IF NOT EXISTS so it's safe to
-- re-run even on projects where the init file was applied) and wires
-- up RLS, realtime, and the insert_notification() helper RPC.
--
-- Fix covers:
--
--   1. CREATE TABLE IF NOT EXISTS notifications — canonical shape
--      used by the GET /api/notifications route and the
--      <NotificationBell /> component: id, user_id, type, title,
--      body, link, read, created_at.
--   2. Indexes on (user_id) and (user_id, read, created_at DESC)
--      so the bell's unread-count query is instant.
--   3. RLS:
--        - SELECT own rows (auth.uid() = user_id)
--        - UPDATE own rows (mark as read)
--        - DELETE own rows (user clears notifications)
--        - Service role has full access (for admin inserts)
--      Plus an INSERT policy for authenticated users who use the
--      user-session client (some legacy code paths still do —
--      the policy is a belt-and-braces fallback).
--   4. public.insert_notification() — SECURITY DEFINER helper so
--      every insert call site can stop worrying about RLS. Bypasses
--      RLS inside the function body; can be called from any route.
--      Returns the inserted row's id.
--   5. Add notifications to the supabase_realtime publication so
--      the <NotificationBell /> realtime subscription fires instantly
--      on INSERT (no more 30s poll).
--   6. GRANT SELECT, UPDATE, DELETE on notifications to authenticated.
--   7. NOTIFY pgrst to reload the schema cache.
--
-- Idempotent — safe to re-run whether the table exists or not. Can
-- also be pasted directly into the Supabase SQL Editor.

-- ── 1. Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  title      text        NOT NULL,
  body       text,
  link       text,
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC);

-- ── 3. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS policies ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own notifications"     ON public.notifications;
DROP POLICY IF EXISTS "Users read own notifications"    ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Users delete own notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Service role insert"             ON public.notifications;
DROP POLICY IF EXISTS "Service role manages notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Permissive INSERT for authenticated users — the service-role admin
-- client bypasses RLS anyway, and having an INSERT policy here lets
-- legacy user-session insert call sites work without a refactor. The
-- insert_notification() RPC below is still the recommended path
-- because it's SECURITY DEFINER and doesn't require this policy.
CREATE POLICY "Authenticated insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 5. insert_notification() SECURITY DEFINER helper ────────────────────────
-- Lets every call site (messages, follows, reviews, orders, webhooks)
-- stop worrying about RLS, the admin client, or whether the user has
-- the right INSERT policy. Bypasses RLS inside the function body;
-- takes the minimum required fields and returns the inserted id.
CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text DEFAULT NULL,
  p_link    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Skip silently if user_id is missing — avoids a CHECK violation
  -- from callers that don't validate upstream.
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_notification(uuid, text, text, text, text)
  TO authenticated, anon;

-- ── 6. Table grants ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- ── 7. Realtime publication ─────────────────────────────────────────────────
-- Enables the <NotificationBell /> realtime subscription so new
-- notifications show up instantly instead of waiting on the 30-second
-- poll interval. EXCEPTION block tolerates "already added" from prior
-- runs.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 8. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
