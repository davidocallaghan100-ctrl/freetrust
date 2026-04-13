-- Grassroots section — everyday workers marketplace
-- ============================================================================
-- Dedicated table for farmers, drivers, tradespeople, and hands-on local
-- service providers who are underserved by the traditional freelance
-- platforms (services / jobs). Structured as a separate table rather than
-- a category on `services` because the data model is genuinely different:
--
--   * rate_type is enum-like (hourly/daily/fixed/negotiable) not a single
--     flat price
--   * contact_preference lets workers opt into whatsapp/phone/email
--     directly rather than forcing everyone through the platform inbox
--   * availability is a 4-bucket enum that drives the coloured card badge
--   * trust_tokens_accepted opts the listing into ₮ payments
--
-- Wrapped in DO $$ + pg_class existence guards following the same
-- defensive pattern as 20260412_marketplace_location.sql and
-- 20260413_profiles_social_links.sql. Re-runnable.

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grassroots_listings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz      NOT NULL DEFAULT now(),
  updated_at             timestamptz      NOT NULL DEFAULT now(),
  -- FK target is profiles(id) rather than auth.users(id) so that
  -- PostgREST can resolve the `poster:profiles!user_id(...)` embedded
  -- select used by /api/grassroots and /api/grassroots/[id]. profiles.id
  -- itself references auth.users(id) ON DELETE CASCADE, so the cascade
  -- chain still removes grassroots listings when an auth user is deleted.
  -- Same pattern the existing jobs/services tables use.
  user_id                uuid             NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  title                  text             NOT NULL,
  description            text,
  category               text             NOT NULL,
  listing_type           text             NOT NULL DEFAULT 'offering'
                                          CHECK (listing_type IN ('offering', 'seeking')),

  rate                   numeric(10,2),
  rate_type              text             DEFAULT 'hourly'
                                          CHECK (rate_type IN ('hourly', 'daily', 'fixed', 'negotiable')),
  currency_code          text             NOT NULL DEFAULT 'EUR',
  rate_eur               numeric(10,2),

  availability           text             DEFAULT 'flexible'
                                          CHECK (availability IN ('immediate', 'this_week', 'this_month', 'flexible')),

  photos                 text[]           NOT NULL DEFAULT '{}',

  country                text,
  region                 text,
  city                   text,
  latitude               double precision,
  longitude              double precision,
  location_label         text,

  is_active              boolean          NOT NULL DEFAULT true,

  contact_preference     text             NOT NULL DEFAULT 'platform'
                                          CHECK (contact_preference IN ('platform', 'whatsapp', 'phone', 'email')),
  contact_value          text,

  trust_tokens_accepted  boolean          NOT NULL DEFAULT false,

  status                 text             NOT NULL DEFAULT 'active'
                                          CHECK (status IN ('active', 'filled', 'expired'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'grassroots_listings' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    CREATE INDEX IF NOT EXISTS grassroots_category_country_city_idx
      ON public.grassroots_listings (category, country, city);
    CREATE INDEX IF NOT EXISTS grassroots_user_id_idx
      ON public.grassroots_listings (user_id);
    CREATE INDEX IF NOT EXISTS grassroots_latlng_idx
      ON public.grassroots_listings (latitude, longitude)
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    CREATE INDEX IF NOT EXISTS grassroots_active_status_idx
      ON public.grassroots_listings (is_active, status);
    CREATE INDEX IF NOT EXISTS grassroots_created_at_idx
      ON public.grassroots_listings (created_at DESC);
  ELSE
    RAISE NOTICE 'skip: public.grassroots_listings does not exist — indexes not added';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grassroots_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grassroots_touch_updated_at_trg ON public.grassroots_listings;
CREATE TRIGGER grassroots_touch_updated_at_trg
  BEFORE UPDATE ON public.grassroots_listings
  FOR EACH ROW EXECUTE FUNCTION public.grassroots_touch_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ────────────────────────────────────────────────────────────────────────────
-- Public read access for active listings only. Owners can see their own
-- inactive/filled/expired listings via the user_id clause on the select
-- policy. Only owners can insert/update/delete.

ALTER TABLE public.grassroots_listings ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies with the same name so this script is
-- safe to re-run.
DROP POLICY IF EXISTS grassroots_public_read     ON public.grassroots_listings;
DROP POLICY IF EXISTS grassroots_owner_read      ON public.grassroots_listings;
DROP POLICY IF EXISTS grassroots_owner_insert    ON public.grassroots_listings;
DROP POLICY IF EXISTS grassroots_owner_update    ON public.grassroots_listings;
DROP POLICY IF EXISTS grassroots_owner_delete    ON public.grassroots_listings;

-- Anyone (including unauthenticated visitors) can SELECT rows where the
-- listing is active AND not filled/expired.
CREATE POLICY grassroots_public_read
  ON public.grassroots_listings
  FOR SELECT
  USING (is_active = true AND status = 'active');

-- Owners can always see their own rows regardless of is_active/status,
-- so they can manage their archived listings.
CREATE POLICY grassroots_owner_read
  ON public.grassroots_listings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Owners can insert rows that belong to themselves.
CREATE POLICY grassroots_owner_insert
  ON public.grassroots_listings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can update their own rows (but not change user_id to someone else).
CREATE POLICY grassroots_owner_update
  ON public.grassroots_listings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owners can delete their own rows. The API layer prefers a soft delete
-- via UPDATE is_active=false, but we still allow hard DELETE for GDPR
-- erasure requests and test fixtures.
CREATE POLICY grassroots_owner_delete
  ON public.grassroots_listings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- GRANTS
-- ────────────────────────────────────────────────────────────────────────────
-- Supabase automatically grants SELECT to `anon` and `authenticated` on
-- new public tables, but spell it out so a stricter project still works.
GRANT SELECT ON public.grassroots_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grassroots_listings TO authenticated;
