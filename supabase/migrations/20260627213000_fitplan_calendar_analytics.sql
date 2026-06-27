-- ============================================================================
-- FreeTrust FitPlan calendar + analytics
-- ============================================================================
-- Adds duration metadata for longer plans and a real completion event table so
-- workout/meal ticks can be shown on date-based calendar and analytics views.
-- No fake or backfilled completion data is inserted.

ALTER TABLE public.fitplan_plans
  ADD COLUMN IF NOT EXISTS duration text NOT NULL DEFAULT 'weekly'
    CHECK (duration IN ('weekly', 'monthly', 'quarterly')),
  ADD COLUMN IF NOT EXISTS starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS total_workouts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_meals integer NOT NULL DEFAULT 0;

UPDATE public.fitplan_plans
SET
  duration = COALESCE(NULLIF(plan_json->>'duration', ''), duration, 'weekly'),
  starts_on = COALESCE((plan_json->>'startDate')::date, starts_on, generated_at::date, CURRENT_DATE),
  ends_on = COALESCE((plan_json->>'endDate')::date, ends_on, COALESCE((plan_json->>'startDate')::date, generated_at::date, CURRENT_DATE) + INTERVAL '6 days'),
  total_workouts = GREATEST(total_workouts, jsonb_array_length(COALESCE(plan_json->'workouts', '[]'::jsonb))),
  total_meals = GREATEST(total_meals, jsonb_array_length(COALESCE(plan_json#>'{nutrition,meals}', '[]'::jsonb)))
WHERE ends_on IS NULL OR total_workouts = 0 OR total_meals = 0;

CREATE TABLE IF NOT EXISTS public.fitplan_completion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.fitplan_plans(id) ON DELETE CASCADE,
  item_kind text NOT NULL CHECK (item_kind IN ('workout', 'meal')),
  item_index integer NOT NULL CHECK (item_index >= 0),
  item_label text,
  scheduled_on date,
  completed_on date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  is_completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id, item_kind, item_index)
);

CREATE INDEX IF NOT EXISTS fitplan_completion_events_user_completed_idx
  ON public.fitplan_completion_events(user_id, completed_on DESC);

CREATE INDEX IF NOT EXISTS fitplan_completion_events_plan_idx
  ON public.fitplan_completion_events(plan_id, item_kind, item_index);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fitplan_completion_events_updated_at') THEN
    CREATE TRIGGER fitplan_completion_events_updated_at BEFORE UPDATE ON public.fitplan_completion_events
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.fitplan_completion_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fitplan_completion_events' AND policyname='Users can view own FitPlan rows') THEN
    CREATE POLICY "Users can view own FitPlan rows" ON public.fitplan_completion_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fitplan_completion_events' AND policyname='Users can insert own FitPlan rows') THEN
    CREATE POLICY "Users can insert own FitPlan rows" ON public.fitplan_completion_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fitplan_completion_events' AND policyname='Users can update own FitPlan rows') THEN
    CREATE POLICY "Users can update own FitPlan rows" ON public.fitplan_completion_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.fitplan_completion_events TO authenticated;

NOTIFY pgrst, 'reload schema';
