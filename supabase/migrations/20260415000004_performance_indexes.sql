-- ============================================================================
-- Performance indexes — audit Section 4f
-- ============================================================================
-- Adds missing indexes to every high-traffic query hot-path
-- identified by the audit. Every CREATE INDEX uses IF NOT EXISTS
-- so the migration is safe on any DB state.
--
-- The indexes target:
--   * trust_ledger — daily cap checks (user_id, type, created_at),
--     wallet history (user_id, created_at desc)
--   * trust_balances — already PK on user_id, no extra index needed
--   * feed_posts — newsfeed load (user_id, created_at desc),
--     status filter
--   * notifications — unread badge (user_id, read, created_at desc)
--   * messages — conversation load (conversation_id, created_at)
--   * listings — search + filter (creator_id, status, category)
--
-- Indexes are created CONCURRENTLY is NOT possible inside a
-- migration transaction, so we use regular CREATE INDEX. This
-- blocks writes on the target table during the build — acceptable
-- during a maintenance window. For live builds on a large DB, run
-- these manually with CONCURRENTLY before applying the rest of
-- the migration.

-- ── trust_ledger ────────────────────────────────────────────────────────────
-- Primary lookup: wallet history by user, ordered by date desc.
CREATE INDEX IF NOT EXISTS trust_ledger_user_created_idx
  ON public.trust_ledger (user_id, created_at DESC);

-- Daily cap check: filter by type + date range (from awardTrust).
-- Composite on (user_id, type, created_at) since the query chains
-- all three predicates.
CREATE INDEX IF NOT EXISTS trust_ledger_user_type_created_idx
  ON public.trust_ledger (user_id, type, created_at DESC);

-- Global type aggregate — e.g. /api/stats "total trust issued by
-- type" reports. Separate from the user-scoped index because the
-- global report has no user_id filter.
CREATE INDEX IF NOT EXISTS trust_ledger_type_created_idx
  ON public.trust_ledger (type, created_at DESC);

-- ── feed_posts ──────────────────────────────────────────────────────────────
-- Author feed: user_id + created_at for profile timelines.
CREATE INDEX IF NOT EXISTS feed_posts_user_created_idx
  ON public.feed_posts (user_id, created_at DESC);

-- Global newsfeed: created_at with status filter. Partial index on
-- status='visible' keeps it small and fast — hidden/deleted posts
-- are rare so they don't need index space.
CREATE INDEX IF NOT EXISTS feed_posts_visible_created_idx
  ON public.feed_posts (created_at DESC)
  WHERE status = 'visible' OR status IS NULL;

-- ── notifications ──────────────────────────────────────────────────────────
-- Unread badge: user_id + read=false + created_at desc. The
-- WHERE clause keeps the index ~10x smaller than the full table
-- because most notifications are already read.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

-- Full notification list for the /notifications page.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- ── messages ────────────────────────────────────────────────────────────────
-- Conversation thread load: filter by conversation_id, order by
-- created_at ascending.
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at ASC);

-- Sender-based moderation queries (e.g. block lookup).
CREATE INDEX IF NOT EXISTS messages_sender_created_idx
  ON public.messages (sender_id, created_at DESC);

-- ── listings ────────────────────────────────────────────────────────────────
-- User's own listings (seller dashboard).
CREATE INDEX IF NOT EXISTS listings_user_status_idx
  ON public.listings (user_id, status);

-- Browse pages — filter by category + status. Most queries also
-- restrict to status='active' so a partial index helps.
CREATE INDEX IF NOT EXISTS listings_category_status_idx
  ON public.listings (category, status);

CREATE INDEX IF NOT EXISTS listings_active_created_idx
  ON public.listings (created_at DESC)
  WHERE status = 'active';

-- Geo filter — country + city for location-scoped browse.
-- These columns may not exist on every env, so wrap in a DO block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'country'
  ) THEN
    CREATE INDEX IF NOT EXISTS listings_country_status_idx
      ON public.listings (country, status);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'city'
  ) THEN
    CREATE INDEX IF NOT EXISTS listings_city_status_idx
      ON public.listings (city, status);
  END IF;
END $$;

-- ── withdrawals ─────────────────────────────────────────────────────────────
-- Re-asserted here in case 20260414000008 was skipped on a rebuild.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'withdrawals' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    CREATE INDEX IF NOT EXISTS withdrawals_user_created_idx
      ON public.withdrawals (user_id, created_at DESC);
  END IF;
END $$;

-- ── orders ──────────────────────────────────────────────────────────────────
-- Wallet history + seller/buyer dashboards query orders by both
-- ends of the transaction with status filters.
CREATE INDEX IF NOT EXISTS orders_buyer_created_idx
  ON public.orders (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_seller_created_idx
  ON public.orders (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_status_idx
  ON public.orders (status);

-- ── profiles ────────────────────────────────────────────────────────────────
-- Username lookup (login, @mentions, profile URL resolution).
-- Unique index so duplicates cannot be inserted.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (username)
  WHERE username IS NOT NULL;

NOTIFY pgrst, 'reload schema';
