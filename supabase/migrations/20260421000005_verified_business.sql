-- Migration: 20260421000005_verified_business.sql
-- Adds verified_at (timestamp of when verification was granted) and
-- verified_by (admin/owner user ID who performed the action) to organisations.
-- is_verified already exists — these two columns add auditability.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS verified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index to quickly list all verified organisations
CREATE INDEX IF NOT EXISTS idx_organisations_is_verified
  ON public.organisations (is_verified)
  WHERE is_verified = true;

NOTIFY pgrst, 'reload schema';
