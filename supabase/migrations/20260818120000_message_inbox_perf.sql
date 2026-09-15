-- ============================================================================
-- Messages inbox performance — single-query inbox + unread count RPCs
-- ============================================================================
-- Root cause of the "Messages" tab being slow / occasionally rendering
-- "No conversations yet" for users who do have conversations:
--
--   1. GET /api/messages built the inbox by looping over every
--      conversation the user is in and firing TWO sequential Supabase
--      queries per conversation (last message, unread count) inside
--      Promise.all. For a user with N conversations that is up to
--      2N+3 network round trips to Postgres before the inbox can
--      render. On a slow/mobile connection with several conversations
--      this stalls for multiple seconds.
--   2. The client (app/messages/page.tsx) had no loading state — the
--      conversation list starts as an empty array and the "No
--      conversations yet" empty state renders immediately, then gets
--      replaced once the slow fetch above finally resolves. On a slow
--      network the empty state is visible long enough that it reads
--      as broken/empty rather than loading.
--
-- This migration adds two SECURITY DEFINER SQL functions that compute
-- the same data in ONE query each, using LATERAL joins so Postgres
-- does the per-conversation last-message/unread-count work internally
-- instead of the application doing it as N round trips:
--
--   - get_message_inbox(p_user_id, p_auto_delete_cutoff) — one row per
--     conversation the user is in, with the last message and unread
--     count already computed. Replaces the N+1 loop in
--     GET /api/messages.
--   - get_unread_message_count(p_user_id) — a single scalar total
--     unread count across all of a user's conversations. Used by the
--     new nav/messages-bell unread badge so it doesn't need to fetch
--     the full inbox just to show a number.
--
-- Both are STABLE + SECURITY DEFINER (consistent with the existing
-- is_conversation_participant/can_read_message helpers in
-- 20260415000009_messaging_rls.sql and
-- 20260606120000_message_replies_attachments_reads.sql) so they can be
-- called safely from RLS-restricted contexts, but they are only
-- invoked from server-side API routes using the admin client, scoped
-- to auth.uid() = the caller's own session user — never take an
-- arbitrary user id from client input without that check upstream.
--
-- Idempotent — safe to re-run.

-- ── 1. Supporting indexes ────────────────────────────────────────────────────
-- Composite indexes matching the LATERAL join predicates below so the
-- planner can use an index scan instead of falling back to the
-- existing single-column indexes (conversation_id) + a filter step.
CREATE INDEX IF NOT EXISTS idx_messages_conv_created_at
  ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conv_sender_created_at
  ON public.messages (conversation_id, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user_last_read
  ON public.conversation_participants (user_id, last_read_at);

-- ── 2. get_message_inbox() ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_message_inbox(
  p_user_id uuid,
  p_auto_delete_cutoff timestamptz DEFAULT NULL
)
RETURNS TABLE (
  conversation_id uuid,
  conv_updated_at timestamptz,
  last_message_at timestamptz,
  last_message_id uuid,
  last_message_sender_id uuid,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_attachments jsonb,
  unread_count bigint,
  other_user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    cp.conversation_id,
    c.updated_at                                    AS conv_updated_at,
    c.last_message_at,
    lm.id                                            AS last_message_id,
    lm.sender_id                                     AS last_message_sender_id,
    lm.content                                       AS last_message_content,
    lm.created_at                                    AS last_message_created_at,
    lm.attachments                                   AS last_message_attachments,
    COALESCE(uc.unread_count, 0)                     AS unread_count,
    op.user_id                                        AS other_user_id
  FROM public.conversation_participants cp
  JOIN public.conversations c
    ON c.id = cp.conversation_id
  LEFT JOIN LATERAL (
    SELECT m.id, m.sender_id, m.content, m.created_at, m.attachments
    FROM public.messages m
    WHERE m.conversation_id = cp.conversation_id
      AND (p_auto_delete_cutoff IS NULL OR m.created_at >= p_auto_delete_cutoff)
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    -- last_read_at IS NULL means this participant has never read the
    -- conversation (e.g. the recipient row inserted when a new
    -- conversation is created never gets a last_read_at until they
    -- open it). Treating NULL as "0 unread" instead of "everything
    -- from the other side is unread" was a real production bug —
    -- fixed here.
    SELECT count(*) AS unread_count
    FROM public.messages m2
    WHERE m2.conversation_id = cp.conversation_id
      AND m2.sender_id <> p_user_id
      AND (cp.last_read_at IS NULL OR m2.created_at > cp.last_read_at)
      AND (p_auto_delete_cutoff IS NULL OR m2.created_at >= p_auto_delete_cutoff)
  ) uc ON true
  LEFT JOIN LATERAL (
    SELECT op2.user_id
    FROM public.conversation_participants op2
    WHERE op2.conversation_id = cp.conversation_id
      AND op2.user_id <> p_user_id
    LIMIT 1
  ) op ON true
  WHERE cp.user_id = p_user_id
  ORDER BY c.last_message_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_message_inbox(uuid, timestamptz)
  TO authenticated;

-- ── 3. get_unread_message_count() ───────────────────────────────────────────
-- Lightweight scalar version for nav badges. Same unread predicate as
-- above but no last-message lookup and no auto-delete cutoff (badge
-- shows raw unread count; the full inbox route still applies the
-- user's message-retention preference for what's actually rendered).
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(uc.unread_count), 0)::bigint
  FROM public.conversation_participants cp
  LEFT JOIN LATERAL (
    SELECT count(*) AS unread_count
    FROM public.messages m2
    WHERE m2.conversation_id = cp.conversation_id
      AND m2.sender_id <> p_user_id
      AND (cp.last_read_at IS NULL OR m2.created_at > cp.last_read_at)
  ) uc ON true
  WHERE cp.user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_message_count(uuid)
  TO authenticated;

-- ── 4. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
