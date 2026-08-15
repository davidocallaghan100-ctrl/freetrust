-- ============================================================================
-- Organisation Stories — minimal extension (approved 2026-08-16)
-- ============================================================================
-- David's simplified scope: organisations do NOT get a separate Stories/
-- Highlights system. They just get to post into the SAME `stories` table/
-- feed as personal stories, using the same display-override pattern already
-- used for feed_posts/articles (see 20260414000001_feed_posts_posted_as_org):
--
--   stories.posted_as_organisation_id  — nullable FK to organisations(id).
--   stories.user_id                    — STILL the real posting member (for
--                                         audit + the "Posted by [member]"
--                                         line). Ownership/permission checks
--                                         go against the org's role when
--                                         posted_as_organisation_id is set,
--                                         not just user_id = auth.uid().
--
-- Permission model (matches /api/create/publish's org check exactly): only
-- organisation_members.role IN ('owner','admin') for that org may
-- insert/delete an org story. Plain 'member' role is blocked — enforced
-- here at the RLS/DB layer, not just in the UI.
--
-- Explicitly OUT of scope per David: no memories.org_id, no separate org
-- Highlights table/grid, no separate org story feed/page. Org stories just
-- show up in the existing Stories bar next to personal ones.
--
-- Project ref: tioqakxnqjxyuzgnwhrb (FreeTrust) — do NOT run against any
-- other Supabase project.
--
-- Idempotent — safe to re-run (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE,
-- DROP POLICY IF EXISTS + CREATE).
-- ============================================================================

-- ── 1. stories.posted_as_organisation_id ────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'stories' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_class c2
      JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
      WHERE c2.relname = 'organisations' AND n2.nspname = 'public' AND c2.relkind = 'r'
    ) THEN
      ALTER TABLE public.stories
        ADD COLUMN IF NOT EXISTS posted_as_organisation_id uuid
          REFERENCES public.organisations(id) ON DELETE CASCADE;
    ELSE
      ALTER TABLE public.stories
        ADD COLUMN IF NOT EXISTS posted_as_organisation_id uuid;
      RAISE NOTICE 'stories.posted_as_organisation_id added WITHOUT FK (organisations table missing)';
    END IF;

    -- Partial index — most rows are NULL (personal stories).
    CREATE INDEX IF NOT EXISTS stories_posted_as_org_idx
      ON public.stories (posted_as_organisation_id)
      WHERE posted_as_organisation_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'skip: public.stories does not exist';
  END IF;
END $$;

-- Note: ON DELETE CASCADE (not SET NULL like feed_posts/articles) — an org
-- story only makes sense as long as the org exists; if the org is deleted,
-- deleting its ephemeral 24h stories along with it (rather than silently
-- reassigning them to look like a personal story from the poster) is the
-- correct behavior here.

-- ── 2. RLS: allow org owner/admin to insert/delete org stories ─────────────
-- Personal story RLS is UNCHANGED for the personal case (posted_as_organisation_id
-- IS NULL) — these policies just add the org branch alongside the existing
-- user_id = auth.uid() check.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'stories' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'organisation_members' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    -- INSERT: user_id must always be the caller (audit trail intact — org
    -- stories are still attributed to the real posting member). If
    -- posted_as_organisation_id is set, the caller must additionally have
    -- an owner/admin role for that org.
    DROP POLICY IF EXISTS "stories insert own" ON public.stories;
    CREATE POLICY "stories insert own"
      ON public.stories FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND (
          posted_as_organisation_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.organisation_members om
            WHERE om.organisation_id = stories.posted_as_organisation_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
          )
        )
      );

    -- DELETE: the original poster can always delete their own story
    -- (personal or org). Additionally, ANY current owner/admin of the org
    -- can delete an org story even if they weren't the one who posted it —
    -- this is moderation/management capability for the org, not just the
    -- individual poster's.
    DROP POLICY IF EXISTS "stories delete own" ON public.stories;
    CREATE POLICY "stories delete own"
      ON public.stories FOR DELETE
      TO authenticated
      USING (
        user_id = auth.uid()
        OR (
          posted_as_organisation_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organisation_members om
            WHERE om.organisation_id = stories.posted_as_organisation_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
          )
        )
      );

    -- UPDATE: left as-is (poster-only) — nothing in this feature needs an
    -- org admin to edit another member's already-posted org story.
  ELSE
    RAISE NOTICE 'skip RLS update: public.stories and/or public.organisation_members missing';
  END IF;
END $$;

-- ── 3. save_story_as_memory: block org stories ──────────────────────────────
-- David: org stories must NOT be saveable into a personal member's Memories
-- (no org Highlights concept exists yet). Re-create the RPC with one added
-- guard; everything else is unchanged from 20260811210000_stories_memories.
CREATE OR REPLACE FUNCTION public.save_story_as_memory(p_story_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story stories;
  v_memory_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_story FROM stories WHERE id = p_story_id;

  IF v_story.id IS NULL THEN
    RAISE EXCEPTION 'Story not found';
  END IF;

  IF v_story.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to save this story as a memory';
  END IF;

  IF v_story.posted_as_organisation_id IS NOT NULL THEN
    RAISE EXCEPTION 'Organisation stories cannot be saved as personal memories';
  END IF;

  INSERT INTO memories (user_id, story_id, media_url, media_type, caption, original_created_at)
  VALUES (v_story.user_id, v_story.id, v_story.media_url, v_story.media_type, v_story.caption, v_story.created_at)
  RETURNING id INTO v_memory_id;

  UPDATE stories SET saved_as_memory = true WHERE id = p_story_id;

  RETURN v_memory_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_story_as_memory(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.save_story_as_memory(uuid) TO authenticated;

-- ── 4. Re-grant + schema reload ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'stories' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
