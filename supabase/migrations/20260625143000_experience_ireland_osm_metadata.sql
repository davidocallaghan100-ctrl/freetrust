-- Experience Ireland-wide OSM metadata + owner delete status support.
-- Applied to FreeTrust Supabase project ref: tioqakxnqjxyuzgnwhrb only.
-- Do not apply to Sales AI One project ref: smttyfjcleqnxexfjgkx.

ALTER TABLE activity_venues ADD COLUMN IF NOT EXISTS data_source text;
ALTER TABLE activity_venues ADD COLUMN IF NOT EXISTS osm_type text;
ALTER TABLE activity_venues ADD COLUMN IF NOT EXISTS osm_id bigint;
ALTER TABLE activity_venues ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE activity_venues ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE activity_venues ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS activity_venues_openstreetmap_unique_idx
  ON activity_venues (osm_type, osm_id)
  WHERE data_source = 'openstreetmap' AND osm_type IS NOT NULL AND osm_id IS NOT NULL;

-- PostgREST/Supabase upsert needs a non-partial conflict target for onConflict=osm_type,osm_id.
-- PostgreSQL unique indexes still allow multiple non-OSM rows with NULL osm_type/osm_id.
CREATE UNIQUE INDEX IF NOT EXISTS pubs_osm_identity_unique_idx
  ON pubs (osm_type, osm_id);

CREATE UNIQUE INDEX IF NOT EXISTS activity_venues_osm_identity_unique_idx
  ON activity_venues (osm_type, osm_id);

DO $$
BEGIN
  ALTER TABLE community_activities DROP CONSTRAINT IF EXISTS community_activities_status_check;
  ALTER TABLE community_activities
    ADD CONSTRAINT community_activities_status_check
    CHECK (status IN ('active','cancelled','completed','draft','deleted'));
END $$;
