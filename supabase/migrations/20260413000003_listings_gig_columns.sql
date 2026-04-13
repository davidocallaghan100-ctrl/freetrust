-- Add gig-rich-data + rating columns to listings + re-grant + reload schema
-- ============================================================================
-- Fixes the runtime error on mobile service creation:
--   "relation public.services does not exist"
--
-- Root cause:
--   * app/api/create/publish/route.ts:289 was writing to a separate
--     `public.services` table via admin.from('services').insert(...)
--   * That table does not exist and was never defined in any migration.
--   * The canonical storage for services in this app is actually
--     `public.listings` with product_type='service' — proven by three
--     read paths: app/services/page.tsx, app/services/[id]/page.tsx,
--     and app/api/admin/content/route.ts, which all read from listings.
--   * The prior 20260413000000_services_gig_columns.sql migration tried
--     to add packages/delivery_types/skills/service_radius to the
--     non-existent services table, so it silently no-op'd behind its
--     IF EXISTS guard. Those columns were never created anywhere.
--   * /api/create/publish is being rewired in this same commit to write
--     to listings, and needs these columns to exist on listings.
--
-- Columns added:
--   packages         jsonb         — { basic, standard, premium } tier blob
--   delivery_types   text[]        — digital/courier/collection/post/etc
--   skills           text[]        — seller skills
--   service_radius   numeric       — km the seller is willing to travel
--   service_mode     text          — 'online'/'offline'/'both'; already
--                                    read by app/services/page.tsx:354
--                                    but never committed to a migration
--   cover_image      text          — hero image URL; already read by
--                                    services browse + featured routes
--                                    but never committed
--   avg_rating       numeric(3,2)  — pre-aggregated from reviews (0-5)
--   review_count     integer       — pre-aggregated review count
--
-- Permissions:
--   Re-GRANT SELECT/INSERT/UPDATE at the TABLE level to anon +
--   authenticated. This overrides any prior column-level grant that may
--   be masking newly-added columns from PostgREST's schema cache — the
--   same fix pattern used in 20260413000001_listings_category_column.sql.
--
-- NOTIFY pgrst 'reload schema' forces PostgREST to rebuild its cache
-- immediately instead of waiting for the next restart.
--
-- Safe to re-run — every statement is idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'listings' AND n.nspname = 'public' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.listings
      -- Gig-rich-data columns (never landed via 20260413000000 because
      -- that migration targeted the non-existent services table).
      ADD COLUMN IF NOT EXISTS packages       jsonb,
      ADD COLUMN IF NOT EXISTS delivery_types text[],
      ADD COLUMN IF NOT EXISTS skills         text[],
      ADD COLUMN IF NOT EXISTS service_radius numeric,
      ADD COLUMN IF NOT EXISTS service_mode   text,

      -- Display columns the read paths already reference but that
      -- were added out-of-band (if at all). Nailing them down properly.
      ADD COLUMN IF NOT EXISTS cover_image    text,
      ADD COLUMN IF NOT EXISTS avg_rating     numeric(3,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS review_count   integer      DEFAULT 0;

    -- GIN indexes on the new text[] columns to support "services
    -- that accept X delivery type" / "services tagged with skill Y"
    -- filter queries. Same pattern as the original services_gig_columns
    -- migration which never landed.
    CREATE INDEX IF NOT EXISTS listings_delivery_types_idx
      ON public.listings USING gin (delivery_types);
    CREATE INDEX IF NOT EXISTS listings_skills_idx
      ON public.listings USING gin (skills);
  ELSE
    RAISE NOTICE 'skip: public.listings does not exist — gig columns not added';
  END IF;
END $$;

-- Re-grant at the TABLE level. Critical for PostgREST schema cache:
-- any prior column-level grant would mask newly-added columns, and
-- table-level grants re-include every current column on the table.
GRANT SELECT, INSERT, UPDATE ON public.listings TO authenticated, anon;

-- Force PostgREST to rebuild its schema cache. Supabase listens on the
-- 'pgrst' channel and fans the reload out to all PostgREST workers.
NOTIFY pgrst, 'reload schema';
