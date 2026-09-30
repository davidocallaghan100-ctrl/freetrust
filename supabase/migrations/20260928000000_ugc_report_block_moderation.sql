-- ============================================================================
-- Apple Guideline 1.2 UGC controls: reports, blocks, and moderation queue
-- ============================================================================
-- Additive only: does not recreate existing feed_posts or side-table feed data.

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id text,
  content_type text NOT NULL DEFAULT 'post',
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
  ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_reporter_idx
  ON public.content_reports (reporter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_reported_user_idx
  ON public.content_reports (reported_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_post_idx
  ON public.content_reports (post_id);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
  ON public.user_blocks (blocked_id, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'content_reports'
      AND policyname = 'Members can create their own reports'
  ) THEN
    CREATE POLICY "Members can create their own reports"
      ON public.content_reports FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = reporter_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'content_reports'
      AND policyname = 'Members can read their own reports'
  ) THEN
    CREATE POLICY "Members can read their own reports"
      ON public.content_reports FOR SELECT
      TO authenticated
      USING (auth.uid() = reporter_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_blocks'
      AND policyname = 'Members can read their own blocks'
  ) THEN
    CREATE POLICY "Members can read their own blocks"
      ON public.user_blocks FOR SELECT
      TO authenticated
      USING (auth.uid() = blocker_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_blocks'
      AND policyname = 'Members can block other members'
  ) THEN
    CREATE POLICY "Members can block other members"
      ON public.user_blocks FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_blocks'
      AND policyname = 'Members can remove their own blocks'
  ) THEN
    CREATE POLICY "Members can remove their own blocks"
      ON public.user_blocks FOR DELETE
      TO authenticated
      USING (auth.uid() = blocker_id);
  END IF;
END $$;

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;

NOTIFY pgrst, 'reload schema';
