-- Phase 1C compatibility: expose the requested `added_at` basket timestamp
-- while preserving the existing `created_at` column used by current app code.
ALTER TABLE public.basket_items
  ADD COLUMN IF NOT EXISTS added_at timestamptz;

UPDATE public.basket_items
SET added_at = COALESCE(added_at, created_at, now())
WHERE added_at IS NULL;

ALTER TABLE public.basket_items
  ALTER COLUMN added_at SET DEFAULT now();
