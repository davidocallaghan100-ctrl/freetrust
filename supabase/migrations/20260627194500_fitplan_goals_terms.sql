-- ==========================================================================
-- FitPlan multi-goal onboarding and explicit safety terms version
-- ==========================================================================
-- Additive only. Existing single-goal profiles keep working; new profiles can
-- store up to five selected goals while `goal` remains the primary goal.

ALTER TABLE public.fitplan_profiles
  ADD COLUMN IF NOT EXISTS goals text[] NOT NULL DEFAULT '{}';

UPDATE public.fitplan_profiles
SET goals = ARRAY[goal]
WHERE (goals IS NULL OR cardinality(goals) = 0)
  AND goal IS NOT NULL;

ALTER TABLE public.fitplan_profiles
  ALTER COLUMN terms_version SET DEFAULT 'fitplan-2026-06-27-safety-v2';

NOTIFY pgrst, 'reload schema';
