-- ============================================================================
-- FreeTrust FitPlan
-- ============================================================================
-- Adds the mobile-first AI fitness/nutrition plan data model, own-row RLS,
-- Trust Coin balance helper, weekly check-in metadata, and idempotent top-up
-- tracking. No seed data is inserted.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.fitplan_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text,
  goal text NOT NULL DEFAULT 'general_wellness',
  experience_level text NOT NULL DEFAULT 'beginner',
  training_days integer NOT NULL DEFAULT 3 CHECK (training_days BETWEEN 1 AND 7),
  preferred_workout_minutes integer NOT NULL DEFAULT 35 CHECK (preferred_workout_minutes BETWEEN 10 AND 180),
  equipment text[] NOT NULL DEFAULT '{}',
  dietary_preferences text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  injuries text,
  doctor_clearance text NOT NULL DEFAULT 'unknown' CHECK (doctor_clearance IN ('yes', 'no', 'unknown')),
  birth_year integer CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND EXTRACT(YEAR FROM now())::integer),
  height_cm numeric(6,2) CHECK (height_cm IS NULL OR (height_cm > 40 AND height_cm < 260)),
  weight_kg numeric(7,3) CHECK (weight_kg IS NULL OR (weight_kg > 20 AND weight_kg < 500)),
  weight_unit text NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  progress_photos_private boolean NOT NULL DEFAULT true,
  share_updates_default boolean NOT NULL DEFAULT false,
  agreed_terms boolean NOT NULL DEFAULT false,
  terms_version text NOT NULL DEFAULT 'fitplan-2026-06-27',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fitplan_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'failed')),
  model text,
  goal text,
  summary text,
  plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_trust integer NOT NULL DEFAULT 50,
  doctor_clearance text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fitplan_plans_user_created_idx
  ON public.fitplan_plans(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fitplan_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.fitplan_plans(id) ON DELETE SET NULL,
  logged_on date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(7,3) CHECK (weight_kg IS NULL OR (weight_kg > 20 AND weight_kg < 500)),
  energy integer CHECK (energy IS NULL OR energy BETWEEN 1 AND 10),
  mood integer CHECK (mood IS NULL OR mood BETWEEN 1 AND 10),
  sleep_hours numeric(4,2) CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  workout_completed boolean NOT NULL DEFAULT false,
  nutrition_hit boolean NOT NULL DEFAULT false,
  notes text,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos_private boolean NOT NULL DEFAULT true,
  share_to_feed boolean NOT NULL DEFAULT false,
  feed_post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fitplan_progress_user_logged_idx
  ON public.fitplan_progress(user_id, logged_on DESC);

CREATE TABLE IF NOT EXISTS public.fitplan_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.fitplan_plans(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  wins text,
  blockers text,
  adherence integer CHECK (adherence IS NULL OR adherence BETWEEN 0 AND 100),
  ai_feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_trust integer NOT NULL DEFAULT 0,
  share_to_feed boolean NOT NULL DEFAULT false,
  feed_post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS fitplan_checkins_user_week_idx
  ON public.fitplan_checkins(user_id, week_start DESC);

CREATE TABLE IF NOT EXISTS public.fitplan_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.fitplan_plans(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  cost_trust integer NOT NULL DEFAULT 0,
  safety_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fitplan_coach_messages_user_created_idx
  ON public.fitplan_coach_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fitplan_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  trust_amount integer NOT NULL CHECK (trust_amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fitplan_topups_user_created_idx
  ON public.fitplan_topups(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fitplan_profiles_updated_at') THEN
    CREATE TRIGGER fitplan_profiles_updated_at BEFORE UPDATE ON public.fitplan_profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fitplan_plans_updated_at') THEN
    CREATE TRIGGER fitplan_plans_updated_at BEFORE UPDATE ON public.fitplan_plans
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fitplan_progress_updated_at') THEN
    CREATE TRIGGER fitplan_progress_updated_at BEFORE UPDATE ON public.fitplan_progress
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fitplan_checkins_updated_at') THEN
    CREATE TRIGGER fitplan_checkins_updated_at BEFORE UPDATE ON public.fitplan_checkins
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fitplan_topups_updated_at') THEN
    CREATE TRIGGER fitplan_topups_updated_at BEFORE UPDATE ON public.fitplan_topups
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_trust_coin_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT balance FROM public.trust_balances WHERE user_id = p_user_id), 0)::integer;
$$;

GRANT EXECUTE ON FUNCTION public.get_trust_coin_balance(uuid) TO anon, authenticated;

ALTER TABLE public.fitplan_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitplan_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitplan_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitplan_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitplan_coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitplan_topups ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fitplan_profiles','fitplan_plans','fitplan_progress','fitplan_checkins','fitplan_coach_messages','fitplan_topups'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='Users can view own FitPlan rows') THEN
      EXECUTE format('CREATE POLICY "Users can view own FitPlan rows" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='Users can insert own FitPlan rows') THEN
      EXECUTE format('CREATE POLICY "Users can insert own FitPlan rows" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    END IF;
    IF t <> 'fitplan_coach_messages' AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='Users can update own FitPlan rows') THEN
      EXECUTE format('CREATE POLICY "Users can update own FitPlan rows" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.fitplan_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fitplan_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fitplan_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fitplan_checkins TO authenticated;
GRANT SELECT, INSERT ON public.fitplan_coach_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fitplan_topups TO authenticated;

NOTIFY pgrst, 'reload schema';
