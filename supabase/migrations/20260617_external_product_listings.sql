CREATE TABLE IF NOT EXISTS external_product_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  price text,
  price_eur numeric,
  currency text DEFAULT 'EUR',
  retailer_name text NOT NULL,
  retailer_url text NOT NULL,
  thumbnail text,
  rating numeric,
  review_count integer,
  category text NOT NULL,
  subcategory text,
  is_trending boolean DEFAULT false,
  source text DEFAULT 'serpapi',
  last_refreshed_at timestamptz DEFAULT now(),
  click_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(retailer_url)
);

CREATE INDEX IF NOT EXISTS idx_external_products_category
  ON external_product_listings(category, is_trending, last_refreshed_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_products_clicks
  ON external_product_listings(click_count DESC);

ALTER TABLE external_product_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read external listings" ON external_product_listings;
CREATE POLICY "Public can read external listings"
  ON external_product_listings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages external listings" ON external_product_listings;
CREATE POLICY "Service role manages external listings"
  ON external_product_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
