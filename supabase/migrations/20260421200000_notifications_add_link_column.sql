-- ============================================================================
-- Add missing `link` column to notifications table
-- ============================================================================
-- The notifications table was created without a `link` column, but every
-- insertNotification() call across the codebase passes a `link` field.
-- PostgREST was rejecting ALL notification inserts with PGRST204
-- ("Could not find the 'link' column"), causing all notifications to
-- silently fail everywhere — messages, job applications, payments, follows,
-- trust awards, etc. No user was receiving any in-app notifications.
--
-- Fix: add the column (IF NOT EXISTS = safe to re-run), reload schema cache.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;

-- Reload PostgREST schema cache so the new column is immediately available.
NOTIFY pgrst, 'reload schema';
