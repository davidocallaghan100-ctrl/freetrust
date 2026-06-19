-- Enrich external service listings so Services Marketplace can merge real
-- external providers into the existing Online/Local category grid.
-- Additive only: no existing FreeTrust service/product/auth data is touched.

ALTER TABLE external_service_listings
  ADD COLUMN IF NOT EXISTS freetrust_category_id text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS image_source text;

CREATE INDEX IF NOT EXISTS idx_external_services_freetrust_category
  ON external_service_listings(freetrust_category_id, service_type, last_refreshed_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_services_geo
  ON external_service_listings(country, city);
