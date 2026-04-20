-- ============================================================================
-- FreeTrust Calendar Feature
-- Migration: 20260420000010_calendar.sql
-- ============================================================================
-- Creates:
--   1. calendar_events  — unified per-user calendar feed
--   2. google_calendar_tokens — stores OAuth tokens for Google Calendar sync
--   3. updated_at trigger on calendar_events
--   4. RLS policies (owner-only on both tables; service_role bypass)
--   5. Triggers on existing: orders, events tables to auto-populate calendar_events
--
-- Safe to re-run — all statements are idempotent.
-- ============================================================================

-- ── 1. calendar_events ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text         NOT NULL,
  description    text,
  start_at       timestamptz  NOT NULL,
  end_at         timestamptz,
  all_day        boolean      NOT NULL DEFAULT false,
  location       text,
  source_type    text         NOT NULL DEFAULT 'manual'
                              CHECK (source_type IN ('gig','product','service','event','reminder','manual')),
  source_id      uuid,
  google_event_id text,
  color          text,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

-- ── 2. Indexes on calendar_events ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx
  ON public.calendar_events (user_id);

CREATE INDEX IF NOT EXISTS calendar_events_start_at_idx
  ON public.calendar_events (start_at);

CREATE INDEX IF NOT EXISTS calendar_events_source_idx
  ON public.calendar_events (source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calendar_events_google_event_id_idx
  ON public.calendar_events (google_event_id)
  WHERE google_event_id IS NOT NULL;

-- ── 3. updated_at trigger on calendar_events ────────────────────────────────
-- Reuse the set_updated_at() function if it already exists (created by
-- the events migration 20260414000002_events_table.sql).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_set_updated_at ON public.calendar_events;
CREATE TRIGGER calendar_events_set_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. RLS on calendar_events ───────────────────────────────────────────────
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events'
      AND policyname='Owner can select own calendar events'
  ) THEN
    CREATE POLICY "Owner can select own calendar events"
      ON public.calendar_events FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events'
      AND policyname='Owner can insert own calendar events'
  ) THEN
    CREATE POLICY "Owner can insert own calendar events"
      ON public.calendar_events FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events'
      AND policyname='Owner can update own calendar events'
  ) THEN
    CREATE POLICY "Owner can update own calendar events"
      ON public.calendar_events FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events'
      AND policyname='Owner can delete own calendar events'
  ) THEN
    CREATE POLICY "Owner can delete own calendar events"
      ON public.calendar_events FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;

-- ── 5. google_calendar_tokens ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  user_id       uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text         NOT NULL,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  synced_at     timestamptz,
  -- Settings flags
  sync_ft_to_google   boolean NOT NULL DEFAULT true,
  sync_google_to_ft   boolean NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS google_calendar_tokens_set_updated_at ON public.google_calendar_tokens;
CREATE TRIGGER google_calendar_tokens_set_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='google_calendar_tokens'
      AND policyname='Owner can manage own google calendar tokens'
  ) THEN
    CREATE POLICY "Owner can manage own google calendar tokens"
      ON public.google_calendar_tokens FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- service_role bypass (needed for the sync API route)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='google_calendar_tokens'
      AND policyname='Service role bypass google calendar tokens'
  ) THEN
    CREATE POLICY "Service role bypass google calendar tokens"
      ON public.google_calendar_tokens FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_tokens TO authenticated;

-- ── 6. Trigger: orders → calendar_events ────────────────────────────────────
-- When an order is placed/updated, upsert a calendar event for both the
-- buyer (product/service received) and seller (gig/service delivery).
-- orders table columns used: id, buyer_id, seller_id, title, type,
-- created_at, updated_at (status column drives the description).
-- We only add/keep a calendar event while order is not cancelled/completed.

CREATE OR REPLACE FUNCTION public.sync_order_to_calendar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_source_type text;
  v_title_buyer text;
  v_title_seller text;
  v_start timestamptz;
BEGIN
  -- Map order type to source_type
  v_source_type := CASE
    WHEN LOWER(COALESCE(NEW.type, '')) = 'product' THEN 'product'
    ELSE 'service'
  END;

  v_start    := COALESCE(NEW.created_at, now());
  v_title_buyer  := COALESCE(NEW.title, 'Order');
  v_title_seller := COALESCE(NEW.title, 'Order');

  IF TG_OP = 'DELETE' THEN
    -- Remove calendar events for both parties on delete
    DELETE FROM public.calendar_events
    WHERE source_type = v_source_type AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Skip cancelled/completed orders — remove any stale calendar event
  IF NEW.status IN ('cancelled', 'completed') THEN
    DELETE FROM public.calendar_events
    WHERE source_type = v_source_type AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Upsert buyer calendar event
  INSERT INTO public.calendar_events
    (user_id, title, description, start_at, source_type, source_id, color)
  VALUES (
    NEW.buyer_id,
    v_title_buyer,
    'Order status: ' || COALESCE(NEW.status, 'pending'),
    v_start,
    v_source_type,
    NEW.id,
    CASE v_source_type WHEN 'product' THEN '#f59e0b' ELSE '#38bdf8' END
  )
  ON CONFLICT (source_type, source_id, user_id)
    DO UPDATE SET
      title       = EXCLUDED.title,
      description = EXCLUDED.description,
      updated_at  = now()
  WHERE calendar_events.user_id = NEW.buyer_id;

  -- Upsert seller calendar event (as a gig delivery)
  INSERT INTO public.calendar_events
    (user_id, title, description, start_at, source_type, source_id, color)
  VALUES (
    NEW.seller_id,
    v_title_seller,
    'Gig to deliver — Status: ' || COALESCE(NEW.status, 'pending'),
    v_start,
    'gig',
    NEW.id,
    '#10b981'
  )
  ON CONFLICT (source_type, source_id, user_id)
    DO UPDATE SET
      title       = EXCLUDED.title,
      description = EXCLUDED.description,
      updated_at  = now()
  WHERE calendar_events.user_id = NEW.seller_id;

  RETURN NEW;
END;
$$;

-- Unique constraint needed for ON CONFLICT above
ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_source_user_uniq;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_source_user_uniq
  UNIQUE (source_type, source_id, user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'orders' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS orders_sync_calendar ON public.orders;
    CREATE TRIGGER orders_sync_calendar
      AFTER INSERT OR UPDATE OR DELETE ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.sync_order_to_calendar();
  END IF;
END $$;

-- ── 7. Trigger: events → calendar_events ────────────────────────────────────
-- When a user creates/updates a FreeTrust event they are hosting, add it
-- to their personal calendar. Uses events.creator_id as user_id.
-- events table columns: id, creator_id, title, description, starts_at, ends_at,
-- venue_name, status.

CREATE OR REPLACE FUNCTION public.sync_event_to_calendar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status IN ('cancelled', 'archived') THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'event' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Resolve the creator's auth user id via profiles
  -- (events.creator_id references profiles.id, not auth.users.id directly,
  --  but profiles.id = auth.users.id per the FreeTrust schema convention)
  INSERT INTO public.calendar_events
    (user_id, title, description, start_at, end_at, location, source_type, source_id, color)
  VALUES (
    NEW.creator_id,
    NEW.title,
    NEW.description,
    COALESCE(NEW.starts_at, now()),
    NEW.ends_at,
    COALESCE(NEW.venue_name, NEW.venue_address),
    'event',
    NEW.id,
    '#8b5cf6'
  )
  ON CONFLICT (source_type, source_id, user_id)
    DO UPDATE SET
      title       = EXCLUDED.title,
      description = EXCLUDED.description,
      start_at    = EXCLUDED.start_at,
      end_at      = EXCLUDED.end_at,
      location    = EXCLUDED.location,
      updated_at  = now()
  WHERE calendar_events.user_id = NEW.creator_id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'events' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS events_sync_calendar ON public.events;
    CREATE TRIGGER events_sync_calendar
      AFTER INSERT OR UPDATE OR DELETE ON public.events
      FOR EACH ROW EXECUTE FUNCTION public.sync_event_to_calendar();
  END IF;
END $$;

-- ── 8. schema cache reload ───────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
