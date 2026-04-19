-- Migration: 20260421000004_listing_quality_score.sql
-- Adds quality_score (computed blend of avg_rating + review_count) and
-- featured_at (timestamp set when a listing earns Featured status) to listings.
-- Also creates recalculate_listing_quality() — called from the reviews API
-- after every new review so scores stay current.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_at   timestamptz;

-- Index so /products and /services can sort by quality_score cheaply
CREATE INDEX IF NOT EXISTS idx_listings_quality_score ON public.listings (quality_score DESC NULLS LAST);

-- ─── RPC: recalculate_listing_quality ─────────────────────────────────────────
-- Blends avg_rating (weight 70%) and a log-dampened review_count (weight 30%)
-- into a 0-100 quality_score.  Sets featured_at when score ≥ 80 for the
-- first time so the Featured badge shows a "since" date.
--
-- Formula:
--   rating_component  = (avg_rating / 5.0) * 70
--   volume_component  = LEAST(ln(review_count + 1) / ln(51), 1) * 30
--   quality_score     = rating_component + volume_component
--
-- Thresholds (used by ListingQualityBadge.tsx):
--   ≥ 80  → Featured  (gold star badge)
--   ≥ 60  → Top Rated (green badge)
--   ≥ 40  → Highly Rated (blue badge)
--   < 40  → no badge
CREATE OR REPLACE FUNCTION public.recalculate_listing_quality(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_rating   numeric(3,2);
  v_review_count integer;
  v_score        numeric(5,2);
  v_featured_at  timestamptz;
BEGIN
  SELECT avg_rating, review_count
    INTO v_avg_rating, v_review_count
    FROM public.listings
   WHERE id = p_listing_id;

  IF v_review_count IS NULL OR v_review_count = 0 THEN
    RETURN;
  END IF;

  v_score := (COALESCE(v_avg_rating, 0) / 5.0 * 70)
           + (LEAST(ln(v_review_count + 1) / ln(51), 1) * 30);

  -- Only set featured_at once (first time the listing earns Featured status)
  IF v_score >= 80 THEN
    SELECT featured_at INTO v_featured_at FROM public.listings WHERE id = p_listing_id;
    IF v_featured_at IS NULL THEN
      v_featured_at := now();
    END IF;
  END IF;

  UPDATE public.listings
     SET quality_score = ROUND(v_score, 2),
         featured_at   = v_featured_at
   WHERE id = p_listing_id;
END;
$$;

-- Grant execute to authenticated role so the reviews API can call it
GRANT EXECUTE ON FUNCTION public.recalculate_listing_quality(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
