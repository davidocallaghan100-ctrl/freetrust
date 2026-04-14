-- ============================================================================
-- RLS safety net for feed_posts — pre-launch audit fix
-- ============================================================================
-- Context: grep across supabase/migrations/ shows NO versioned migration
-- that creates the public.feed_posts table OR its RLS policies. The table
-- appears to have been created ad-hoc via the Supabase UI (same story as
-- the events table was before 20260414000002_events_table.sql). The app
-- relies on it heavily:
--
--   * app/api/feed/posts/route.ts       — list feed + insert new post
--   * app/api/create/publish/route.ts   — primary publish path (text /
--                                         photo / video / link / poll)
--   * app/api/feed/post/route.ts        — alternate (dead?) quick post
--   * app/api/feed/posts/[id]/*         — like / save / comment / react
--   * app/feed/page.tsx                 — read + realtime subscribe
--   * app/feed/[id]/page.tsx            — detail view
--   * app/dashboard/page.tsx            — my posts count
--
-- Because no versioned migration defines the table, if production had its
-- RLS policies edited / reset via the Supabase UI at any point, INSERTs
-- against feed_posts from the cookie-aware client (anon-key session) would
-- be silently blocked. Users would click Publish and nothing would happen —
-- the same class of bug the profile edit button had before commit 595fd4f.
--
-- This migration does NOT create the table (production state is canonical;
-- guessing at the shape and running a conflicting CREATE TABLE could cause
-- more harm than good). It only:
--
--   1. ENABLE ROW LEVEL SECURITY on the table (no-op if already enabled)
--   2. Idempotently create the SELECT / INSERT / UPDATE / DELETE policies
--      if they don't already exist, wrapped in DO $$ IF NOT EXISTS blocks
--      so re-runs are safe.
--   3. Table-level GRANTs so PostgREST sees every column (standard fix
--      pattern — see 20260413000001_listings_category_column.sql for the
--      bug history).
--   4. NOTIFY pgrst to rebuild the schema cache.
--
-- Guarded on pg_class existence — if public.feed_posts doesn't exist at
-- all, the entire DO block skips with a RAISE NOTICE so the migration
-- degrades gracefully.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'feed_posts' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    RAISE NOTICE 'skip: public.feed_posts does not exist — create the table first via the Supabase UI or a dedicated schema migration';
    RETURN;
  END IF;

  -- ── 1. Ensure RLS is enabled ──────────────────────────────────────────────
  ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

  -- ── 2. SELECT — public read ───────────────────────────────────────────────
  -- Matches the "Active listings are viewable by everyone" pattern from
  -- lib/supabase/schema.sql. feed_posts has no `status` gate in the app
  -- (soft-deleted posts filter client-side or via a future column), so
  -- this policy is just `using (true)`.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feed_posts'
      AND policyname = 'Feed posts are viewable by everyone'
  ) THEN
    CREATE POLICY "Feed posts are viewable by everyone"
      ON public.feed_posts FOR SELECT
      USING (true);
  END IF;

  -- ── 3. INSERT — authenticated authors only ────────────────────────────────
  -- Users can only insert posts where user_id matches their own uid.
  -- This is the policy most likely to have been missing in production —
  -- without it, every Publish click silently failed on fresh accounts.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feed_posts'
      AND policyname = 'Authors can create own posts'
  ) THEN
    CREATE POLICY "Authors can create own posts"
      ON public.feed_posts FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- ── 4. UPDATE — authors can edit own posts ────────────────────────────────
  -- Includes WITH CHECK so a user can't pivot a post to someone else's
  -- user_id via an UPDATE. id is a primary key and can't be changed,
  -- but belt-and-braces.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feed_posts'
      AND policyname = 'Authors can update own posts'
  ) THEN
    CREATE POLICY "Authors can update own posts"
      ON public.feed_posts FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- ── 5. DELETE — authors can delete own posts ──────────────────────────────
  -- /api/feed/posts/[id]/route.ts implements DELETE gated on the caller
  -- being the author. RLS is the backstop.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feed_posts'
      AND policyname = 'Authors can delete own posts'
  ) THEN
    CREATE POLICY "Authors can delete own posts"
      ON public.feed_posts FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. Table-level grants ────────────────────────────────────────────────────
-- Standard fix for the "newly-added column masked by an older
-- column-level grant" problem. Table-level grants re-include every
-- current column on the relation, so PostgREST sees everything
-- including posted_as_organisation_id (added in 188d96c) and any
-- columns added in the future.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'feed_posts' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT ON public.feed_posts TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
  END IF;
END $$;

-- ── 7. Schema cache reload ───────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
