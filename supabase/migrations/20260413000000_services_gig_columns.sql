-- Gig packages + rich-data columns on services
-- ============================================================================
-- The gig create form (app/seller/gigs/create/page.tsx) collects far more
-- data than the services table can currently store. Before this migration
-- the publish flow dropped six fields with a single console.warn:
--
--   packages         — basic/standard/premium tiered pricing
--   delivery_types   — digital / courier / collection / post / same-day / etc
--   tags             — free-text discovery tags
--   skills           — seller skills
--   images           — up to 5 cover photos per gig
--   service_radius   — how far the seller is willing to travel
--
-- This migration adds all six as nullable columns so:
--   * existing rows are unaffected (every new column defaults to NULL)
--   * the insert path can stop using toPgTagArray / toPgUrlArray where
--     they'd previously been needed as a workaround for the missing
--     columns (they're still used for the text[] coercion bug, but
--     that's a separate concern)
--
-- Re-runnable via ADD COLUMN IF NOT EXISTS + DO $$ guards following the
-- same defensive pattern as 20260412_marketplace_location.sql.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'services' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.services
      -- Tiered packages stored as a single JSONB blob with the shape
      --   { basic: {...}, standard: {...}, premium: {...} }
      -- Each tier has: name, description, price, deliveryTime, revisions, features[]
      -- jsonb (not json) so we can query individual fields with -> / ->> if
      -- a future feature wants e.g. "show me all gigs with a basic tier
      -- under €50".
      ADD COLUMN IF NOT EXISTS packages       jsonb,

      -- Array columns. All nullable; empty arrays are indistinguishable
      -- from NULL at the app layer (the form sends [] which toPgTagArray
      -- encodes as '{}' — the same literal Postgres uses for empty).
      ADD COLUMN IF NOT EXISTS delivery_types text[],
      ADD COLUMN IF NOT EXISTS tags           text[],
      ADD COLUMN IF NOT EXISTS skills         text[],
      ADD COLUMN IF NOT EXISTS images         text[],

      -- service_radius: numeric because the form stores things like
      -- "5km", "25km", "National", "International". We parse the km
      -- number on the client and send as a float; the text label is
      -- regenerable on display. Nullable because online gigs don't
      -- have a physical radius.
      ADD COLUMN IF NOT EXISTS service_radius numeric;
  ELSE
    RAISE NOTICE 'skip: public.services does not exist — gig columns not added';
  END IF;
END $$;

-- Indexes to support the two likely filter patterns once gig browse gets
-- richer: "gigs that accept X delivery type" and "gigs tagged with Y".
-- Both are GIN because text[] equality / contains use GIN efficiently.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'services' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    CREATE INDEX IF NOT EXISTS services_delivery_types_idx
      ON public.services USING gin (delivery_types);
    CREATE INDEX IF NOT EXISTS services_tags_idx
      ON public.services USING gin (tags);
    CREATE INDEX IF NOT EXISTS services_skills_idx
      ON public.services USING gin (skills);
  END IF;
END $$;
