-- ============================================================================
-- Create public.events table
-- ============================================================================
-- Fixes the "Could not find the table 'public.events' in the schema cache"
-- error on /events and every feed endpoint that queries events. The table
-- was previously created ad-hoc via the Supabase UI (not in a migration)
-- and either was never provisioned or was dropped — either way, no
-- version-controlled definition exists in lib/supabase/schema.sql.
--
-- Column set compiled from every reference in the codebase (audited
-- file-by-file before writing this migration):
--
--   app/api/events/route.ts                   — POST insert
--   app/api/create/publish/route.ts           — POST insert (type='event')
--   app/events/page.tsx                       — client SELECT
--   app/api/feed/posts/route.ts fetchEvents   — feed SELECT + filter
--   app/api/cron/event-reminders/route.ts     — SELECT
--   app/api/events/[id]/rsvp/route.ts         — SELECT/UPDATE attendee_count
--   app/api/search/route.ts                   — SELECT + filter
--   app/api/admin/analytics/route.ts          — SELECT
--   app/sitemap.ts                            — SELECT
--
-- NOTE: app/events/calendar/page.tsx references stale legacy column names
--   (start_date, end_date, location, meeting_url, .order('date'))
--   that don't match any other file. Those are NOT included in this
--   schema — the calendar page is broken independently and needs a
--   separate fix to read the canonical starts_at / ends_at / venue_name
--   columns. Creating synonym columns would be worse than the bug.
--
-- Idempotent — all CREATE TABLE / INDEX / POLICY statements use
-- IF NOT EXISTS guards so the migration can be re-run safely.

-- ── 1. Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id                  uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Author — FK to profiles(id) to match the existing "creator_id" pattern
  -- on listings, articles, and communities. profiles.id is itself
  -- "references auth.users(id) on delete cascade" so deleting an auth
  -- user still cascades correctly.
  creator_id          uuid                 NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Core content
  title               text                 NOT NULL,
  description         text,
  category            text,
  cover_image_url     text,
  tags                text[]               NOT NULL DEFAULT '{}',

  -- Lifecycle
  status              text                 NOT NULL DEFAULT 'published'
                                           CHECK (status IN ('draft','published','cancelled','archived')),

  -- Timing. starts_at / ends_at are nullable because commit 567638c
  -- (the "events not showing" fix) explicitly allows events with no
  -- fixed start time to appear in the feed. Clients that need a start
  -- time still validate it at INSERT time; null-starts_at events just
  -- sort to the end via nullsFirst: false on the order clause.
  starts_at           timestamptz,
  ends_at             timestamptz,
  timezone            text                 NOT NULL DEFAULT 'UTC',

  -- Mode + location
  is_online           boolean              NOT NULL DEFAULT false,
  venue_name          text,
  venue_address       text,
  meeting_url         text,

  -- Ticketing
  is_paid             boolean              NOT NULL DEFAULT false,
  ticket_price        numeric(10,2)        NOT NULL DEFAULT 0,
  -- ticket_price_eur is the normalised-to-EUR value used by the
  -- globalisation filter + sort path. Kept distinct from ticket_price
  -- so the original currency is preserved for display.
  ticket_price_eur    numeric(10,2)        NOT NULL DEFAULT 0,
  currency_code       text                 NOT NULL DEFAULT 'EUR',

  -- Attendance
  max_attendees       integer,
  attendee_count      integer              NOT NULL DEFAULT 0,

  -- Organiser display strings — optional override for when the creator
  -- wants a different name/bio than their profile (e.g. "Tuesday Night
  -- Run Club" instead of the creator's personal profile name).
  organiser_name      text,
  organiser_bio       text,

  -- Globalisation (matches the 20260412_marketplace_location.sql pattern
  -- on listings — same column names so the shared haversine helper and
  -- country/city filter components work without branching).
  country             text,
  region              text,
  city                text,
  latitude            double precision,
  longitude           double precision,
  location_label      text,

  created_at          timestamptz          NOT NULL DEFAULT now(),
  updated_at          timestamptz          NOT NULL DEFAULT now()
);

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
-- status — every feed / listing query filters on status='published'
CREATE INDEX IF NOT EXISTS events_status_idx
  ON public.events (status);

-- starts_at — the upcoming filter (.gte('starts_at', now())) and the
-- default order ('starts_at' ASC) both hit this
CREATE INDEX IF NOT EXISTS events_starts_at_idx
  ON public.events (starts_at);

-- creator_id — "my events" + "events by this user" profile tab
CREATE INDEX IF NOT EXISTS events_creator_id_idx
  ON public.events (creator_id);

-- Globalisation — matches the pattern from 20260412_marketplace_location.sql
CREATE INDEX IF NOT EXISTS events_country_city_idx
  ON public.events (country, city);

CREATE INDEX IF NOT EXISTS events_latlng_idx
  ON public.events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── 3. Auto-update `updated_at` on UPDATE ───────────────────────────────────
-- Reuses the standard pattern. Creates the helper function only if it
-- doesn't already exist (other tables may have created it already).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public read of published events — matches the base "Active listings
-- are viewable by everyone" pattern from lib/supabase/schema.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
      AND policyname = 'Published events are viewable by everyone'
  ) THEN
    CREATE POLICY "Published events are viewable by everyone"
      ON public.events FOR SELECT
      USING (status = 'published' OR auth.uid() = creator_id);
  END IF;
END $$;

-- Authenticated users can create events, but only as themselves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
      AND policyname = 'Authenticated users can create events'
  ) THEN
    CREATE POLICY "Authenticated users can create events"
      ON public.events FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = creator_id);
  END IF;
END $$;

-- Creators can update their own events (RSVP count updates go through
-- the admin client, so they bypass this; this policy is for the
-- creator's own edit page at app/events/[id]/edit/page.tsx)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
      AND policyname = 'Creators can update own events'
  ) THEN
    CREATE POLICY "Creators can update own events"
      ON public.events FOR UPDATE
      TO authenticated
      USING (auth.uid() = creator_id)
      WITH CHECK (auth.uid() = creator_id);
  END IF;
END $$;

-- Creators can delete their own events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
      AND policyname = 'Creators can delete own events'
  ) THEN
    CREATE POLICY "Creators can delete own events"
      ON public.events FOR DELETE
      TO authenticated
      USING (auth.uid() = creator_id);
  END IF;
END $$;

-- ── 5. Grants — per the fix spec ────────────────────────────────────────────
-- Table-level grants so PostgREST sees every column. Standard fix
-- pattern: any prior column-level grant would mask newly-added
-- columns, and table-level grants re-include them all.
GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE ON public.events TO authenticated;
GRANT DELETE ON public.events TO authenticated;

-- ── 6. Schema cache reload ──────────────────────────────────────────────────
-- Tells PostgREST to rebuild its schema cache right now so the new
-- table is immediately queryable via the REST API instead of waiting
-- for the next worker restart.
NOTIFY pgrst, 'reload schema';
