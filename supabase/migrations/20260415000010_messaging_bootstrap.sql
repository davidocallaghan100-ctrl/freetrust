-- ============================================================================
-- Messaging subsystem bootstrap — tables + RLS + helper + realtime
-- ============================================================================
-- Follow-up to 20260415000009_messaging_rls.sql. That migration
-- fixed the infinite-recursion RLS bug but ASSUMED the messaging
-- tables (conversations, conversation_participants, messages)
-- already existed. If the production Supabase project was never
-- initialised with 20240101000000_messaging.sql the tables are
-- missing entirely, and every call to POST /api/conversations
-- from the Message button on a profile fails with "relation
-- \"public.conversations\" does not exist".
--
-- This migration is fully self-contained:
--
--   1. CREATE TABLE IF NOT EXISTS for conversations,
--      conversation_participants and messages — including the
--      unique (conversation_id, user_id) pair on participants so
--      the dedup logic in POST /api/conversations works.
--   2. Indexes matching the original 20240101000000_messaging.sql.
--   3. The is_conversation_participant(uuid) SECURITY DEFINER
--      helper function, re-asserted idempotently.
--   4. All RLS policies, dropped and recreated via the helper so
--      the recursion bug cannot come back.
--   5. Table-level grants (belt-and-braces).
--   6. supabase_realtime publication entries wrapped in an
--      EXCEPTION block so "already added" isn't a failure.
--   7. NOTIFY pgrst so the new tables + policies show up in the
--      REST API immediately instead of waiting on a worker
--      restart.
--
-- Safe to run in the Supabase SQL Editor directly — every step
-- is idempotent. Re-running leaves the DB in the same state.

-- ── 1. Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_read_at    timestamptz,
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  content         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  is_deleted      boolean     NOT NULL DEFAULT false,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb
);

-- ── 2. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id            ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id                  ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at_desc            ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_id           ON public.conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conversation_id   ON public.conversation_participants (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at_desc  ON public.conversations (last_message_at DESC);

-- ── 3. Enable RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.conversations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                   ENABLE ROW LEVEL SECURITY;

-- ── 4. is_conversation_participant() helper ─────────────────────────────────
-- SECURITY DEFINER so inside the function RLS evaluates as the
-- function owner (typically `postgres`) — owner bypasses RLS,
-- which breaks the recursion cycle when this function is called
-- from an RLS policy on the same table.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conv_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conv_id
      AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid)
  TO authenticated, anon;

-- ── 5. conversation_participants policies ───────────────────────────────────
DROP POLICY IF EXISTS "participants_select"                 ON public.conversation_participants;
DROP POLICY IF EXISTS "Users view own participant row"      ON public.conversation_participants;
DROP POLICY IF EXISTS "Users view participants of own conv" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_insert"                 ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated can insert participant" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_update"                 ON public.conversation_participants;
DROP POLICY IF EXISTS "Users update own partrow"            ON public.conversation_participants;

CREATE POLICY "Users view own participant row"
  ON public.conversation_participants
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users view participants of own conv"
  ON public.conversation_participants
  FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

CREATE POLICY "Authenticated can insert participant"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

CREATE POLICY "Users update own partrow"
  ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 6. conversations policies ───────────────────────────────────────────────
DROP POLICY IF EXISTS "conversations_select"                ON public.conversations;
DROP POLICY IF EXISTS "Users view conversations they are in" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert"                ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can create conversation" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update"                ON public.conversations;
DROP POLICY IF EXISTS "Users update conversations they are in" ON public.conversations;

CREATE POLICY "Users view conversations they are in"
  ON public.conversations
  FOR SELECT
  USING (public.is_conversation_participant(id));

CREATE POLICY "Authenticated can create conversation"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users update conversations they are in"
  ON public.conversations
  FOR UPDATE
  USING (public.is_conversation_participant(id))
  WITH CHECK (public.is_conversation_participant(id));

-- ── 7. messages policies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select"                    ON public.messages;
DROP POLICY IF EXISTS "Users read messages in own convs"   ON public.messages;
DROP POLICY IF EXISTS "messages_insert"                    ON public.messages;
DROP POLICY IF EXISTS "Users insert messages in own convs" ON public.messages;
DROP POLICY IF EXISTS "messages_update"                    ON public.messages;
DROP POLICY IF EXISTS "Senders update own messages"        ON public.messages;

CREATE POLICY "Users read messages in own convs"
  ON public.messages
  FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

CREATE POLICY "Users insert messages in own convs"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

CREATE POLICY "Senders update own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- ── 8. Table-level grants ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.conversations              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages                   TO authenticated;

-- ── 9. Realtime publication ─────────────────────────────────────────────────
-- Wrap each ALTER in its own BEGIN/EXCEPTION block so "already
-- added" doesn't abort the whole migration.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 10. Reload PostgREST schema cache ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
