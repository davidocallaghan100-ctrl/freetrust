ALTER TABLE external_product_clicks
ADD COLUMN IF NOT EXISTS affiliate_link_generated boolean DEFAULT false;

ALTER TABLE external_product_clicks
ADD COLUMN IF NOT EXISTS click_source text DEFAULT 'grid'
  CHECK (click_source IN ('grid', 'modal', 'basket', 'find_online'));
