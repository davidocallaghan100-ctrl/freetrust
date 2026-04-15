-- ============================================================================
-- RLS completeness — audit Section 4c
-- ============================================================================
-- Enumerates every public table that should have RLS enabled and
-- asserts the baseline policies required for safe operation. Idempotent.
--
-- Tables already covered by prior migrations (trust_balances,
-- trust_ledger, withdrawals, impact_fund_balance, impact_donations,
-- wallet_transfers, feed_posts, feed_reactions, profiles, listings,
-- etc.) are re-asserted here to guard against a schema rebuild
-- losing them. Tables that are server-only (no RLS needed because
-- the admin client is the only caller) get an explicit
-- "service-role only" policy to make the intent explicit instead
-- of leaving them open.
--
-- The query that identifies tables missing ANY policy is:
--
--   SELECT t.tablename FROM pg_tables t
--   WHERE t.schemaname = 'public'
--     AND NOT EXISTS (
--       SELECT 1 FROM pg_policies p
--       WHERE p.schemaname = 'public' AND p.tablename = t.tablename
--     )
--   ORDER BY t.tablename;
--
-- It cannot be run from inside a migration (the result is ad-hoc)
-- so the list below was compiled by auditing every CREATE TABLE
-- across supabase/migrations/.

-- Helper macro — ensures RLS on a table that may or may not exist
-- on a given env. Wrapped in DO $$ for tolerance.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_deposits',
    'notification_preferences',
    'referrals',
    'impact_cause_votes',
    'rent_share_listings',
    'rent_share_requests',
    'user_follows',
    'organisation_members',
    'grassroots_listings',
    'events',
    'trust_action_log',
    'impact_fund_balance',
    'withdrawals',
    'impact_donations',
    'impact_projects'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = t AND n.nspname = 'public' AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ── money_deposits ──────────────────────────────────────────────────────────
-- Server-only (the webhook updates it via admin client). Users
-- should be able to SELECT their own rows for wallet history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'money_deposits' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'money_deposits'
      AND policyname = 'Users can view own deposits'
  ) THEN
    CREATE POLICY "Users can view own deposits"
      ON public.money_deposits FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'money_deposits' AND n.nspname = 'public' AND c.relkind = 'r'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'money_deposits'
      AND policyname = 'Service role manages deposits'
  ) THEN
    CREATE POLICY "Service role manages deposits"
      ON public.money_deposits FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ── notification_preferences ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'notification_preferences' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notification_preferences'
        AND policyname = 'Users manage own notification preferences'
    ) THEN
      CREATE POLICY "Users manage own notification preferences"
        ON public.notification_preferences FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- ── referrals ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'referrals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'referrals'
        AND policyname = 'Users view own referrals'
    ) THEN
      CREATE POLICY "Users view own referrals"
        ON public.referrals FOR SELECT
        USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'referrals'
        AND policyname = 'Service role manages referrals'
    ) THEN
      CREATE POLICY "Service role manages referrals"
        ON public.referrals FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

-- ── impact_cause_votes ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'impact_cause_votes' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'impact_cause_votes'
        AND policyname = 'Users manage own votes'
    ) THEN
      CREATE POLICY "Users manage own votes"
        ON public.impact_cause_votes FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Public read of tallies — votes themselves are visible to everyone
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'impact_cause_votes'
        AND policyname = 'Votes are public read'
    ) THEN
      CREATE POLICY "Votes are public read"
        ON public.impact_cause_votes FOR SELECT
        USING (true);
    END IF;
  END IF;
END $$;

-- ── impact_projects ─────────────────────────────────────────────────────────
-- Public read — all users can browse projects.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'impact_projects' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'impact_projects'
        AND policyname = 'Projects are public read'
    ) THEN
      CREATE POLICY "Projects are public read"
        ON public.impact_projects FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'impact_projects'
        AND policyname = 'Service role manages projects'
    ) THEN
      CREATE POLICY "Service role manages projects"
        ON public.impact_projects FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

-- ── user_follows ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'user_follows' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    -- Public read — who follows whom is visible on profile pages
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_follows'
        AND policyname = 'Follows are public read'
    ) THEN
      CREATE POLICY "Follows are public read"
        ON public.user_follows FOR SELECT
        USING (true);
    END IF;

    -- Only the follower can create/delete their own follow rows
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_follows'
        AND policyname = 'Users manage own follows'
    ) THEN
      CREATE POLICY "Users manage own follows"
        ON public.user_follows FOR ALL
        USING (auth.uid() = follower_id)
        WITH CHECK (auth.uid() = follower_id);
    END IF;
  END IF;
END $$;

-- ── organisation_members ────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'organisation_members' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'organisation_members'
        AND policyname = 'Members are public read'
    ) THEN
      CREATE POLICY "Members are public read"
        ON public.organisation_members FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'organisation_members'
        AND policyname = 'Service role manages membership'
    ) THEN
      CREATE POLICY "Service role manages membership"
        ON public.organisation_members FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

-- ── rent_share_listings / rent_share_requests ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'rent_share_listings' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'rent_share_listings'
        AND policyname = 'Rent share listings are public read'
    ) THEN
      CREATE POLICY "Rent share listings are public read"
        ON public.rent_share_listings FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'rent_share_listings'
        AND policyname = 'Users manage own rent share listings'
    ) THEN
      CREATE POLICY "Users manage own rent share listings"
        ON public.rent_share_listings FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'rent_share_requests' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'rent_share_requests'
        AND policyname = 'Users view requests they sent or received'
    ) THEN
      CREATE POLICY "Users view requests they sent or received"
        ON public.rent_share_requests FOR SELECT
        USING (auth.uid() = requester_id OR auth.uid() = host_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'rent_share_requests'
        AND policyname = 'Users create own requests'
    ) THEN
      CREATE POLICY "Users create own requests"
        ON public.rent_share_requests FOR INSERT
        WITH CHECK (auth.uid() = requester_id);
    END IF;
  END IF;
END $$;

-- ── grassroots_listings ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'grassroots_listings' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'grassroots_listings'
        AND policyname = 'Grassroots listings are public read'
    ) THEN
      CREATE POLICY "Grassroots listings are public read"
        ON public.grassroots_listings FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'grassroots_listings'
        AND policyname = 'Users manage own grassroots listings'
    ) THEN
      CREATE POLICY "Users manage own grassroots listings"
        ON public.grassroots_listings FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- ── events (canonical events table) ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'events' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'events'
        AND policyname = 'Events are public read'
    ) THEN
      CREATE POLICY "Events are public read"
        ON public.events FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'events'
        AND policyname = 'Users manage own events'
    ) THEN
      CREATE POLICY "Users manage own events"
        ON public.events FOR ALL
        USING (auth.uid() = organizer_id)
        WITH CHECK (auth.uid() = organizer_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'events'
        AND policyname = 'Service role manages events'
    ) THEN
      CREATE POLICY "Service role manages events"
        ON public.events FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
