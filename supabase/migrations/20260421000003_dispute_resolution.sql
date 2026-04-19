-- Migration: 20260421000003_dispute_resolution.sql
-- Enhances disputes table with structured resolution flow:
-- - resolution_steps: jsonb thread of buyer/seller responses
-- - evidence_urls: array of uploaded proof URLs
-- - resolved_in_favour_of: who won (buyer | seller | split)
-- - due_by: 72-hour response deadline auto-set on creation
-- - closed_at / escalated_at: lifecycle timestamps

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS resolution_steps       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved_in_favour_of  text         CHECK (resolved_in_favour_of IN ('buyer', 'seller', 'split')),
  ADD COLUMN IF NOT EXISTS closed_at              timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at           timestamptz,
  ADD COLUMN IF NOT EXISTS due_by                 timestamptz;

-- Auto-set due_by = created_at + 72h when a dispute is inserted
-- (seller has 72 hours to respond before auto-escalation)
CREATE OR REPLACE FUNCTION public.set_dispute_due_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.due_by IS NULL THEN
    NEW.due_by := COALESCE(NEW.created_at, now()) + INTERVAL '72 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispute_set_due_by ON public.disputes;
CREATE TRIGGER dispute_set_due_by
  BEFORE INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_dispute_due_by();

NOTIFY pgrst, 'reload schema';
