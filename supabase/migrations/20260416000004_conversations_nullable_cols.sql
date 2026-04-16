-- ============================================================================
-- conversations — drop legacy NOT NULL constraints on purchase-context cols
-- ============================================================================
-- Fixes the "direct messages between members blocked" bug where
-- POST /api/conversations would fail with a NOT NULL violation on
-- conversations.buyer_id (and potentially seller_id / listing_id)
-- because the original purchase-flow schema pre-dates the profile-
-- to-profile messaging feature. Direct messages don't have a buyer,
-- seller, or listing — those columns are only meaningful when the
-- conversation is tied to an order or a marketplace enquiry.
--
-- Fix — three DROP NOT NULLs:
--
--   conversations.buyer_id    DROP NOT NULL
--   conversations.seller_id   DROP NOT NULL
--   conversations.listing_id  DROP NOT NULL
--
-- Wrapped in a DO block that checks each column exists first so
-- the migration is safe on schemas where any of the three were
-- already nullable (or never existed, for projects built after
-- the messaging refactor).
--
-- The foreign keys on these columns (if any) are left in place —
-- only the NOT NULL constraint changes. A NULL value for any of
-- them now signals "not a purchase-context conversation", which
-- is the canonical meaning.
--
-- Idempotent — safe to re-run. Safe to paste into the Supabase
-- SQL Editor directly.

DO $$
BEGIN
  -- buyer_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'conversations'
       AND column_name  = 'buyer_id'
       AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.conversations ALTER COLUMN buyer_id DROP NOT NULL;
  END IF;

  -- seller_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'conversations'
       AND column_name  = 'seller_id'
       AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.conversations ALTER COLUMN seller_id DROP NOT NULL;
  END IF;

  -- listing_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'conversations'
       AND column_name  = 'listing_id'
       AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.conversations ALTER COLUMN listing_id DROP NOT NULL;
  END IF;
END $$;

-- Reload PostgREST schema cache so the new nullability is picked up
-- by the REST API immediately, not on the next worker restart.
NOTIFY pgrst, 'reload schema';
