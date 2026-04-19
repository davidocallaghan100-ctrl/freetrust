-- ============================================================
-- Full-text search indexes
-- ============================================================
-- Replaces expensive ILIKE '%...%' full-table scans with GIN
-- tsvector indexes across the platform's core searchable tables.
--
-- Each table gets:
--   1. A generated tsvector column (STORED) built from the most
--      relevant text columns using 'english' dictionary.
--   2. A GIN index on that column for fast @@ lookups.
--
-- The search route (/api/search) and individual list routes
-- (/api/listings, /api/businesses, etc.) are updated separately
-- to use .textSearch() instead of .ilike().
--
-- Using STORED columns (not triggers) keeps writes simple and
-- ensures Postgres maintains the index automatically.
-- ============================================================

-- ── digest_run_checkpoints ───────────────────────────────────
-- Required by the weekly-digest cron for resumability. Created
-- here because it is part of the same migration batch.
CREATE TABLE IF NOT EXISTS digest_run_checkpoints (
  job_name   TEXT PRIMARY KEY,
  last_cursor TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── listings (title + description) ──────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(title, '') || ' ' || coalesce(description, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS listings_search_vector_idx
  ON listings USING GIN (search_vector);

-- ── profiles (full_name + bio) ───────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(full_name, '') || ' ' || coalesce(bio, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS profiles_search_vector_idx
  ON profiles USING GIN (search_vector);

-- ── organisations (name + description) ──────────────────────
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(name, '') || ' ' || coalesce(description, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS organisations_search_vector_idx
  ON organisations USING GIN (search_vector);

-- NOTE: grassroots listings live in the main `listings` table filtered by
-- product_type='grassroots' — no separate table exists. The listings index above covers them.

-- ── events (title + description) ────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(title, '') || ' ' || coalesce(description, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS events_search_vector_idx
  ON events USING GIN (search_vector);

-- ── articles (title + body) ──────────────────────────────────
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(title, '') || ' ' || coalesce(body, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS articles_search_vector_idx
  ON articles USING GIN (search_vector);

-- ── jobs (title + description) ───────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(title, '') || ' ' || coalesce(description, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS jobs_search_vector_idx
  ON jobs USING GIN (search_vector);
