-- Globalise + localise FreeTrust marketplaces
-- ============================================================================
-- Adds structured location columns (country, city, region, lat/lng, label,
-- is_remote, currency_code) to every listing table plus the profiles table,
-- and creates a lightweight haversine helper function so the browse APIs
-- can filter by distance without needing PostGIS.
--
-- Safe to re-run: every statement is idempotent (ADD COLUMN IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION).
--
-- Design notes:
--   * country is ISO 3166-1 alpha-2 (e.g. 'IE', 'US', 'GB'). Text not enum so
--     new countries can be added without schema changes.
--   * currency_code is ISO 4217 (e.g. 'EUR', 'USD', 'GBP'). The base currency
--     for the FreeTrust platform is EUR; every listing price is ALSO stored
--     in EUR via `price_eur` so browse pages can sort/filter on a single
--     currency without needing a runtime conversion for every row.
--   * latitude / longitude are plain double precision. Haversine on an
--     indexed (country, city) prefilter is fast enough for the foreseeable
--     data volume. If/when volume justifies it, switch to earthdistance or
--     PostGIS without changing the API contract.
--   * is_remote applies to jobs and services. For products and events it
--     defaults to false and is ignored by the UI.

-- ────────────────────────────────────────────────────────────────────────────
-- LISTINGS (products)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS region         text,
  ADD COLUMN IF NOT EXISTS city           text,
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS is_remote      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency_code  text,
  ADD COLUMN IF NOT EXISTS price_eur      numeric(10,2);

CREATE INDEX IF NOT EXISTS listings_country_city_idx    ON listings (country, city);
CREATE INDEX IF NOT EXISTS listings_latlng_idx          ON listings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- SERVICES
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS region         text,
  ADD COLUMN IF NOT EXISTS city           text,
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS is_remote      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency_code  text,
  ADD COLUMN IF NOT EXISTS price_eur      numeric(10,2);

CREATE INDEX IF NOT EXISTS services_country_city_idx    ON services (country, city);
CREATE INDEX IF NOT EXISTS services_latlng_idx          ON services (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS services_remote_idx          ON services (is_remote) WHERE is_remote = true;

-- ────────────────────────────────────────────────────────────────────────────
-- JOBS  (already has `location` text + `location_type` enum — we add the
-- structured breakdown so filtering can use city/country without string
-- munging. is_remote is derived from location_type in the API layer, but
-- we also add it as a plain boolean for consistency with services.)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS region         text,
  ADD COLUMN IF NOT EXISTS city           text,
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS is_remote      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency_code  text,
  ADD COLUMN IF NOT EXISTS salary_min_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS salary_max_eur numeric(10,2);

CREATE INDEX IF NOT EXISTS jobs_country_city_idx        ON jobs (country, city);
CREATE INDEX IF NOT EXISTS jobs_latlng_idx              ON jobs (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_remote_idx              ON jobs (is_remote) WHERE is_remote = true;

-- ────────────────────────────────────────────────────────────────────────────
-- EVENTS  (has is_online already; we extend with geocoords so the Leaflet
-- map view can place pins without re-geocoding every event on each render.)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS region         text,
  ADD COLUMN IF NOT EXISTS city           text,
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS currency_code  text,
  ADD COLUMN IF NOT EXISTS ticket_price_eur numeric(10,2);

CREATE INDEX IF NOT EXISTS events_country_city_idx      ON events (country, city);
CREATE INDEX IF NOT EXISTS events_latlng_idx            ON events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- PROFILES  (has `location` text already; we add the structured breakdown
-- used for defaulting browse filters and for displaying the user's local
-- currency. No price_eur here — profiles don't have prices.)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS region         text,
  ADD COLUMN IF NOT EXISTS city           text,
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS currency_code  text;

CREATE INDEX IF NOT EXISTS profiles_country_idx         ON profiles (country)
  WHERE country IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- HAVERSINE HELPER
-- ────────────────────────────────────────────────────────────────────────────
-- Returns the great-circle distance in kilometres between two lat/lng
-- points. IMMUTABLE + PARALLEL SAFE so the planner can inline and
-- parallelise it inside WHERE clauses.
--
-- Usage in a query:
--   SELECT * FROM listings
--   WHERE haversine_km(latitude, longitude, $user_lat, $user_lng) <= $radius
--   ORDER BY haversine_km(latitude, longitude, $user_lat, $user_lng) ASC;
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) RETURNS double precision AS $$
DECLARE
  r constant double precision := 6371.0;
  dlat double precision;
  dlng double precision;
  a    double precision;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat / 2) ^ 2
     + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ^ 2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1 - a));
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
