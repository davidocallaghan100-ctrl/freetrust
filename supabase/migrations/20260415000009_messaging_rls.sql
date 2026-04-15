-- ============================================================================
-- Messaging RLS — infinite-recursion fix + helper RPC
-- ============================================================================
-- Fixes the "messaging is completely broken" bug on /messages and
-- every downstream query that touches conversation_participants.
--
-- Root cause:
--   The original migration (20240101000000_messaging.sql) defined
--   participants_select as:
--
--     CREATE POLICY "participants_select" ON conversation_participants
--       FOR SELECT USING (
--         conversation_id IN (
--           SELECT conversation_id FROM conversation_participants
--           WHERE user_id = auth.uid()
--         )
--       );
--
--   The subquery inside the policy runs against the same table the
--   policy is attached to — Postgres 15+ detects this as infinite
--   recursion and raises SQLSTATE 42P17 "infinite recursion detected
--   in policy for relation conversation_participants". Every
--   client-side SELECT on conversation_participants fails. Cascades:
--
--   * conversations_select subqueries participants → recursion,
--     listing my conversations returns 0 rows
--   * messages_select subqueries participants → recursion, message
--     history never loads
--   * The /messages page's loadConversations catches the error with
--     `catch { /* use mock */ }` so the UI silently renders an empty
--     list instead of exposing the failure
--
-- Fix — two layered changes:
--
--   1. Create a SECURITY DEFINER helper function
--      `public.is_conversation_participant(p_conv_id uuid)` that
--      checks membership. SECURITY DEFINER runs with the function
--      owner's privileges, bypassing RLS inside the function body,
--      which breaks the recursion cycle: the policy calls the
--      function, the function's inner SELECT runs as the owner
--      (RLS bypassed), the result flows back to the policy, done.
--
--   2. Drop the recursive policies on conversation_participants,
--      conversations and messages, and recreate them using the
--      helper function. Same access semantics, no recursion.
--
-- Idempotent — safe to re-run. DROP POLICY IF EXISTS, CREATE OR
-- REPLACE FUNCTION, ENABLE RLS is a no-op when already on.

-- ── 1. Ensure RLS is enabled on all three tables ────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'conversations' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'conversation_participants' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'messages' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ── 2. is_conversation_participant() helper ────────────────────────────────
-- SECURITY DEFINER so inside the function RLS is evaluated as the
-- function owner (typically `postgres`) — the owner bypasses RLS,
-- which breaks the recursion cycle when this function is called
-- from an RLS policy on the same table.
--
-- STABLE so Postgres can cache the result within a single query.
-- SET search_path = public protects against privilege escalation via
-- search_path manipulation.
--
-- Takes the conversation id as an argument and reads auth.uid()
-- from the calling session — so policies pass only the conversation
-- id (no need to thread the user id through every callsite).
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

-- ── 3. conversation_participants policies ──────────────────────────────────
-- DROP all existing select policies then recreate using the helper.
-- Two SELECT policies: users can always see their own row (needed
-- for "list my conversations" and the dedup query from the POST
-- /api/conversations route), and users can see other participants
-- of conversations they're in (needed for the thread header which
-- shows the other user's name + avatar).
DROP POLICY IF EXISTS "participants_select"                 ON public.conversation_participants;
DROP POLICY IF EXISTS "Users view own participant row"      ON public.conversation_participants;
DROP POLICY IF EXISTS "Users view participants of own conv" ON public.conversation_participants;

CREATE POLICY "Users view own participant row"
  ON public.conversation_participants
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users view participants of own conv"
  ON public.conversation_participants
  FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

-- INSERT: authenticated user can insert a row for themselves OR for
-- a conversation they're already in (needed when adding a second
-- participant to a freshly-created conversation).
DROP POLICY IF EXISTS "participants_insert"                  ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated can insert participant" ON public.conversation_participants;

CREATE POLICY "Authenticated can insert participant"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

-- UPDATE: only your own row (e.g. last_read_at timestamp).
DROP POLICY IF EXISTS "participants_update"       ON public.conversation_participants;
DROP POLICY IF EXISTS "Users update own partrow"  ON public.conversation_participants;

CREATE POLICY "Users update own partrow"
  ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 4. conversations policies ───────────────────────────────────────────────
-- SELECT: any conversation where the current user is a participant.
-- Rewritten to use the helper so it's consistent with the
-- participants policy above and bypasses RLS cleanly.
DROP POLICY IF EXISTS "conversations_select"                ON public.conversations;
DROP POLICY IF EXISTS "Users view conversations they are in" ON public.conversations;

CREATE POLICY "Users view conversations they are in"
  ON public.conversations
  FOR SELECT
  USING (public.is_conversation_participant(id));

-- INSERT: any authenticated user can create a conversation row.
-- The participants policy above enforces that they immediately
-- join it as a participant.
DROP POLICY IF EXISTS "conversations_insert"              ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can create conversation" ON public.conversations;

CREATE POLICY "Authenticated can create conversation"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: members of the conversation can touch updated_at and
-- last_message_at (done from /api/messages after an insert).
DROP POLICY IF EXISTS "conversations_update"                    ON public.conversations;
DROP POLICY IF EXISTS "Users update conversations they are in"  ON public.conversations;

CREATE POLICY "Users update conversations they are in"
  ON public.conversations
  FOR UPDATE
  USING (public.is_conversation_participant(id))
  WITH CHECK (public.is_conversation_participant(id));

-- ── 5. messages policies ────────────────────────────────────────────────────
-- SELECT: any message where the current user is a participant of
-- the conversation the message belongs to. Helper function again.
DROP POLICY IF EXISTS "messages_select"                    ON public.messages;
DROP POLICY IF EXISTS "Users read messages in own convs"   ON public.messages;

CREATE POLICY "Users read messages in own convs"
  ON public.messages
  FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

-- INSERT: authenticated users can send messages to conversations
-- they're a participant of. sender_id must match auth.uid() so a
-- user can't spoof someone else's sender id.
DROP POLICY IF EXISTS "messages_insert"                    ON public.messages;
DROP POLICY IF EXISTS "Users insert messages in own convs" ON public.messages;

CREATE POLICY "Users insert messages in own convs"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

-- UPDATE: senders can edit / soft-delete their own messages.
DROP POLICY IF EXISTS "messages_update"            ON public.messages;
DROP POLICY IF EXISTS "Senders update own messages" ON public.messages;

CREATE POLICY "Senders update own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- ── 6. Table-level grants ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.conversations              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages                   TO authenticated;

-- ── 7. Realtime publication ─────────────────────────────────────────────────
-- Idempotent re-add — DROP PUBLICATION ... is not safe because it
-- would reset ownership of every table. Instead wrap in a DO block
-- that tolerates "relation already added" errors.
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

-- ── 8. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
