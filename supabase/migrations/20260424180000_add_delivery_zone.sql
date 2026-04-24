-- Add delivery zone columns to listings table
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS delivery_scope TEXT,
  ADD COLUMN IF NOT EXISTS delivery_origin_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_origin_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_countries TEXT[],
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Scope constraint
ALTER TABLE listings
  ADD CONSTRAINT listings_delivery_scope_check
  CHECK (delivery_scope IN ('local','national','international','worldwide'));

-- delivery_notes max length
ALTER TABLE listings
  ADD CONSTRAINT listings_delivery_notes_length
  CHECK (char_length(delivery_notes) <= 200);

-- Enforce delivery_scope NOT NULL for physical products
ALTER TABLE listings
  ADD CONSTRAINT listings_product_delivery_scope
  CHECK (listing_type != 'product' OR delivery_scope IS NOT NULL);

-- Enforce local fields when scope=local
ALTER TABLE listings
  ADD CONSTRAINT listings_local_delivery_fields
  CHECK (
    delivery_scope != 'local' OR (
      delivery_origin_lat IS NOT NULL AND
      delivery_origin_lng IS NOT NULL AND
      delivery_radius_km IS NOT NULL
    )
  );

-- Enforce radius range when present
ALTER TABLE listings
  ADD CONSTRAINT listings_delivery_radius_range
  CHECK (delivery_radius_km IS NULL OR (delivery_radius_km >= 1 AND delivery_radius_km <= 500));
