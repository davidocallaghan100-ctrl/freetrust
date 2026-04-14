-- ============================================================================
-- Post as organisation — schema support
-- ============================================================================
-- Enables org admins/owners/creators to publish feed posts and articles
-- under the organisation's identity instead of their personal profile.
--
-- Ownership model: posts are still OWNED by the human author (user_id /
-- author_id stays populated) so audit, trust reward accounting, and
-- moderation all stay anchored to a real person. The
-- posted_as_organisation_id column is purely a DISPLAY OVERRIDE — when
-- set, the feed renders the org's name/logo in place of the author's,
-- and the byline links to the org profile. If the org is deleted,
-- ON DELETE SET NULL reverts the post to a normal personal post rather
-- than cascading-deleting user content.
--
-- Four independent changes in this migration, all idempotent:
--
--   1. feed_posts.posted_as_organisation_id column + FK + partial index
--   2. articles.posted_as_organisation_id    column + FK + partial index
--      (articles appear in the feed via the fetchArticles helper and
--      render through the same PostCard, so they need the same column)
--   3. Trigger on organisations INSERT — auto-add a row to
--      organisation_members with role='owner' for the creator, so the
--      "post as org" permission check (which queries
--      organisation_members) doesn't silently fail for the creator of
--      a fresh org.
--   4. Retroactive backfill — insert organisation_members{owner} rows
--      for every existing org where the creator isn't already a member.
--      Needed because every existing org predates the trigger.
--
-- Safe to re-run — every ADD COLUMN is IF NOT EXISTS, the trigger uses
-- CREATE OR REPLACE + DROP/CREATE, and the backfill uses ON CONFLICT
-- DO NOTHING.

-- ── 1. feed_posts.posted_as_organisation_id ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'feed_posts' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    -- Only attach the FK if organisations actually exists. On a
    -- project that never ran the organisations schema, the REFERENCES
    -- clause would fail with "relation public.organisations does not
    -- exist" and nuke the whole migration.
    IF EXISTS (
      SELECT 1 FROM pg_class c2
      JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
      WHERE c2.relname = 'organisations' AND n2.nspname = 'public' AND c2.relkind = 'r'
    ) THEN
      ALTER TABLE public.feed_posts
        ADD COLUMN IF NOT EXISTS posted_as_organisation_id uuid
          REFERENCES public.organisations(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.feed_posts
        ADD COLUMN IF NOT EXISTS posted_as_organisation_id uuid;
      RAISE NOTICE 'feed_posts.posted_as_organisation_id added WITHOUT FK (organisations table missing)';
    END IF;

    -- Partial index — most rows will be NULL (personal posts) so a
    -- full index would waste space. Powers the org profile page's
    -- "posts by this org" tab we may add later.
    CREATE INDEX IF NOT EXISTS feed_posts_posted_as_org_idx
      ON public.feed_posts (posted_as_organisation_id)
      WHERE posted_as_organisation_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'skip: public.feed_posts does not exist';
  END IF;
END $$;

-- ── 2. articles.posted_as_organisation_id ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'articles' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_class c2
      JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
      WHERE c2.relname = 'organisations' AND n2.nspname = 'public' AND c2.relkind = 'r'
    ) THEN
      ALTER TABLE public.articles
        ADD COLUMN IF NOT EXISTS posted_as_organisation_id uuid
          REFERENCES public.organisations(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.articles
        ADD COLUMN IF NOT EXISTS posted_as_organisation_id uuid;
      RAISE NOTICE 'articles.posted_as_organisation_id added WITHOUT FK (organisations table missing)';
    END IF;

    CREATE INDEX IF NOT EXISTS articles_posted_as_org_idx
      ON public.articles (posted_as_organisation_id)
      WHERE posted_as_organisation_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'skip: public.articles does not exist';
  END IF;
END $$;

-- ── 3. Trigger: auto-add creator to organisation_members on org create ─────
-- Without this, an org creator has a row in public.organisations with
-- creator_id = their uid, but NO row in public.organisation_members.
-- The "post as org" permission check queries organisation_members by
-- (organisation_id, user_id) and falls back to the creator_id lookup,
-- but having an explicit membership row is a data-integrity fix that
-- makes every caller (including future code) agree on who's in the org.
--
-- SECURITY DEFINER so the trigger can insert even when the caller's
-- session has no INSERT grant on organisation_members — the row is
-- effectively system-created, not user-created.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'organisations' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'organisation_members' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    CREATE OR REPLACE FUNCTION public.handle_new_organisation()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      IF NEW.creator_id IS NOT NULL THEN
        INSERT INTO public.organisation_members (organisation_id, user_id, role, title, joined_at)
        VALUES (NEW.id, NEW.creator_id, 'owner', 'Founder', now())
        ON CONFLICT (organisation_id, user_id) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS on_organisation_created ON public.organisations;
    CREATE TRIGGER on_organisation_created
      AFTER INSERT ON public.organisations
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_organisation();
  ELSE
    RAISE NOTICE 'skip: organisations and/or organisation_members table missing';
  END IF;
END $$;

-- ── 4. Retroactive backfill — owner rows for existing orgs ──────────────────
-- Every org created before this migration has no corresponding
-- organisation_members row. Walk the organisations table and insert
-- an owner row for each creator. ON CONFLICT DO NOTHING handles the
-- rare case where a membership row already exists (e.g. creator was
-- manually added via POST /api/organisations/[id]/members).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'organisations' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'organisation_members' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    INSERT INTO public.organisation_members (organisation_id, user_id, role, title, joined_at)
    SELECT o.id, o.creator_id, 'owner', 'Founder', COALESCE(o.created_at, now())
    FROM public.organisations o
    WHERE o.creator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.organisation_members m
        WHERE m.organisation_id = o.id
          AND m.user_id = o.creator_id
      )
    ON CONFLICT (organisation_id, user_id) DO NOTHING;
  END IF;
END $$;

-- ── 5. Re-grant + schema reload ─────────────────────────────────────────────
-- Standard PostgREST schema-cache fix: re-grant at TABLE level so the
-- new columns aren't masked by any prior column-level grant. Same
-- pattern as 20260413000001_listings_category_column.sql.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'feed_posts' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON public.feed_posts TO authenticated, anon;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'articles' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON public.articles TO authenticated, anon;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'organisation_members' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, DELETE ON public.organisation_members TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
