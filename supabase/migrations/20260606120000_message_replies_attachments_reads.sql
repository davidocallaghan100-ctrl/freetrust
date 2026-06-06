-- ============================================================================
-- Messaging phase 1 — replies, attachments, and per-message read receipts
-- ============================================================================
-- Manual migration for Supabase SQL Editor. Do not auto-apply from the agent.
--
-- Current conversations are used as 1:1 threads by the UI, but the schema is
-- participant-based and does not enforce a maximum of two participants. Because
-- future/group conversations are possible, read state is stored in a separate
-- message_reads table instead of a single messages.read_at column.

-- ── 1. Message columns ──────────────────────────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Keep attachment metadata shaped as an array. The app stores objects like:
-- { url, type, name, size }.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_attachments_is_array'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_attachments_is_array
      CHECK (jsonb_typeof(attachments) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id
  ON public.messages (reply_to_id);

-- ── 2. Per-user/per-message read receipts ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reads (
  message_id uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_user_id
  ON public.message_reads (user_id);

CREATE INDEX IF NOT EXISTS idx_message_reads_read_at
  ON public.message_reads (read_at DESC);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Helper used by read-receipt policies. SECURITY DEFINER intentionally mirrors
-- public.is_conversation_participant(uuid): it checks the message's conversation
-- without triggering recursive RLS policy evaluation.
CREATE OR REPLACE FUNCTION public.can_read_message(p_message_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversation_participants cp
      ON cp.conversation_id = m.conversation_id
    WHERE m.id = p_message_id
      AND cp.user_id = auth.uid()
  );
$$;

-- A user can create/update a receipt only for their own user_id, only when they
-- are a participant in the message's conversation, and never for their own sent
-- message. This gives recipients read-receipt write access without allowing any
-- edit to message content.
CREATE OR REPLACE FUNCTION public.can_write_message_read(p_message_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p_user_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.messages m
       JOIN public.conversation_participants cp
         ON cp.conversation_id = m.conversation_id
       WHERE m.id = p_message_id
         AND cp.user_id = auth.uid()
         AND m.sender_id <> auth.uid()
     );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_message(uuid)
  TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.can_write_message_read(uuid, uuid)
  TO authenticated;

DROP POLICY IF EXISTS "Users view read receipts in own conversations" ON public.message_reads;
DROP POLICY IF EXISTS "Recipients create own message read receipts"    ON public.message_reads;
DROP POLICY IF EXISTS "Recipients update own message read receipts"    ON public.message_reads;

CREATE POLICY "Users view read receipts in own conversations"
  ON public.message_reads
  FOR SELECT
  TO authenticated
  USING (public.can_read_message(message_id));

CREATE POLICY "Recipients create own message read receipts"
  ON public.message_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_message_read(message_id, user_id));

CREATE POLICY "Recipients update own message read receipts"
  ON public.message_reads
  FOR UPDATE
  TO authenticated
  USING (public.can_write_message_read(message_id, user_id))
  WITH CHECK (public.can_write_message_read(message_id, user_id));

GRANT SELECT, INSERT, UPDATE ON public.message_reads TO authenticated;

-- Keep the existing sender-only messages UPDATE policy in place. Recipients do
-- not need UPDATE on public.messages to mark reads, so they cannot change
-- content, attachments, reply_to_id, metadata, or is_deleted via read receipts.

-- ── 3. Realtime publication ─────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Reload PostgREST schema cache so new columns/table are visible immediately.
NOTIFY pgrst, 'reload schema';
