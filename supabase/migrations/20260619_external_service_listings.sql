-- External service marketplace listings and lead capture.
-- Real provider data only: SerpApi organic results and Awin partner merchants.

CREATE TABLE IF NOT EXISTS external_service_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  provider_name text NOT NULL,
  provider_url text NOT NULL,
  description text,
  category text NOT NULL,
  service_type text CHECK (service_type IN ('local', 'remote', 'both')),
  price_display text,
  rating numeric,
  review_count integer,
  location text,
  thumbnail text,
  source text DEFAULT 'serpapi' CHECK (source IN ('serpapi', 'awin')),
  awin_merchant_id text,
  awin_deeplink text,
  is_awin boolean DEFAULT false,
  click_count integer DEFAULT 0,
  lead_count integer DEFAULT 0,
  last_refreshed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(provider_url)
);

CREATE INDEX IF NOT EXISTS idx_external_services_category
  ON external_service_listings(category, last_refreshed_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_services_source
  ON external_service_listings(source, is_awin);

ALTER TABLE external_service_listings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_service_listings'
      AND policyname = 'Public can read external services'
  ) THEN
    CREATE POLICY "Public can read external services"
      ON external_service_listings FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_service_listings'
      AND policyname = 'Service role manages external services'
  ) THEN
    CREATE POLICY "Service role manages external services"
      ON external_service_listings FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_enquiry_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service_listing_id uuid REFERENCES external_service_listings(id) ON DELETE SET NULL,
  community_service_id uuid,
  provider_name text NOT NULL,
  provider_url text,
  category text NOT NULL,
  enquiry_message text,
  user_name text,
  user_email text,
  source text DEFAULT 'external' CHECK (source IN ('external', 'community', 'awin')),
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'forwarded', 'converted')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_enquiry_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_enquiry_leads'
      AND policyname = 'Users manage own leads'
  ) THEN
    CREATE POLICY "Users manage own leads"
      ON service_enquiry_leads FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_enquiry_leads'
      AND policyname = 'Service role reads all leads'
  ) THEN
    CREATE POLICY "Service role reads all leads"
      ON service_enquiry_leads FOR SELECT TO service_role
      USING (true);
  END IF;
END $$;
