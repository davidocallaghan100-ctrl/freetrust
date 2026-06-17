CREATE TABLE IF NOT EXISTS external_product_clicks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  search_query text NOT NULL,
  product_title text NOT NULL,
  retailer_name text NOT NULL,
  product_url text NOT NULL,
  clicked_at timestamptz DEFAULT now()
);

ALTER TABLE external_product_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can log their own clicks" ON external_product_clicks;
CREATE POLICY "Users can log their own clicks"
  ON external_product_clicks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role reads all" ON external_product_clicks;
CREATE POLICY "Service role reads all"
  ON external_product_clicks
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Anonymous users can log external clicks" ON external_product_clicks;
CREATE POLICY "Anonymous users can log external clicks"
  ON external_product_clicks
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);
