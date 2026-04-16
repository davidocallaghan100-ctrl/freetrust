-- ============================================================================
-- Irish impact causes — 12 new causes + schema additions + suggestions table
-- ============================================================================
-- Adds 12 Ireland-focused causes to impact_projects. Each cause is
-- inserted with WHERE NOT EXISTS on `name` so re-running the migration
-- doesn't duplicate rows (impact_projects doesn't have a UNIQUE(name)
-- constraint; adding one would risk failing on any existing dupes in
-- production, so we use the safer WHERE NOT EXISTS pattern).
--
-- Also:
--   1. Adds `emoji` column — spec asks for an emoji per cause, and the
--      existing avatar_initials + avatar_gradient combo is for letter-
--      based avatars (GR, SS, PC) rather than single-emoji tiles.
--   2. Adds `featured` boolean — spec asks for "Most needed" / "Featured"
--      tag on priority causes (End Homelessness, Mental Health Support,
--      Food Banks). The UI sorts featured=true first.
--   3. Creates cause_suggestions table for the "Suggest a Cause" form
--      at the bottom of /impact. Authenticated user_id is optional so
--      anons can suggest too; admin reviews via the admin dashboard.
--
-- Idempotent — safe to re-run.

-- ── 1. Schema additions to impact_projects ─────────────────────────────────
ALTER TABLE public.impact_projects
  ADD COLUMN IF NOT EXISTS emoji    text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS impact_projects_featured_idx
  ON public.impact_projects (featured DESC, sort_order ASC);

-- ── 2. Seed 12 Irish causes ─────────────────────────────────────────────────
-- Pattern: INSERT ... SELECT WHERE NOT EXISTS. Keeps the migration
-- idempotent without requiring a UNIQUE(name) constraint (which
-- would fail if production already has duplicates for any reason).

-- Housing & Homelessness — FEATURED
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'End Homelessness in Ireland',
  'Housing',
  'Ireland',
  'Support frontline homeless services across Ireland — emergency shelters, food banks, outreach workers and housing-first programmes helping people off the streets.',
  'Every person deserves a safe place to sleep',
  '🏠', true, 50000, '₮', 'EH',
  'linear-gradient(135deg,#f87171,#b91c1c)',
  ARRAY['Housing','Homelessness','Ireland']::text[],
  ARRAY[1,11]::int[],
  10, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'End Homelessness in Ireland');

INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Emergency Housing Fund',
  'Housing',
  'Ireland',
  'Provide emergency accommodation deposits and rent support for families and individuals facing homelessness due to eviction or financial hardship.',
  'Keeping families together and off the streets',
  '🔑', false, 30000, '₮', 'EH',
  'linear-gradient(135deg,#fb923c,#ea580c)',
  ARRAY['Housing','Rent','Families']::text[],
  ARRAY[1,11]::int[],
  11, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Emergency Housing Fund');

-- Mental Health — "Mental Health Support Ireland" is FEATURED
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Mental Health Support Ireland',
  'Mental Health',
  'Ireland',
  'Fund free and low-cost mental health services including counselling, crisis support lines and community wellbeing programmes across Ireland.',
  'Mental health is everyone''s business',
  '🧠', true, 40000, '₮', 'MH',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  ARRAY['Mental Health','Counselling','Crisis']::text[],
  ARRAY[3]::int[],
  20, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Mental Health Support Ireland');

INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Youth Mental Health',
  'Mental Health',
  'Ireland',
  'Support mental health programmes in Irish schools and youth clubs — early intervention, mindfulness programmes and peer support networks for young people aged 12–24.',
  'Investing in the mental health of the next generation',
  '💚', false, 25000, '₮', 'YM',
  'linear-gradient(135deg,#34d399,#059669)',
  ARRAY['Youth','Schools','Mental Health']::text[],
  ARRAY[3,4]::int[],
  21, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Youth Mental Health');

-- Food Poverty — "Food Banks & Community Kitchens" is FEATURED
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Food Banks & Community Kitchens',
  'Food Poverty',
  'Ireland',
  'Support community food banks, soup kitchens and meals-on-wheels services helping families and elderly people across Ireland who cannot afford enough food.',
  'No one in Ireland should go hungry',
  '🍽️', true, 20000, '₮', 'FB',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  ARRAY['Food','Poverty','Community']::text[],
  ARRAY[2]::int[],
  30, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Food Banks & Community Kitchens');

INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'School Meals Programme',
  'Education',
  'Ireland',
  'Ensure every child in Ireland has access to a nutritious meal at school. Support expansion of free school meals to DEIS schools and disadvantaged communities.',
  'A full stomach makes for a better learner',
  '🥗', false, 15000, '₮', 'SM',
  'linear-gradient(135deg,#34d399,#059669)',
  ARRAY['Schools','Meals','Children']::text[],
  ARRAY[2,4]::int[],
  40, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'School Meals Programme');

-- Environment & Sustainability
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Clean Coasts Ireland',
  'Environment',
  'Irish coastline',
  'Fund community beach and coastal clean-up initiatives around the Irish coastline — removing plastic waste, restoring habitats and educating local communities on ocean conservation.',
  'Protecting Ireland''s coastline for future generations',
  '🌊', false, 20000, '₮', 'CC',
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  ARRAY['Ocean','Coastal','Conservation']::text[],
  ARRAY[14,15]::int[],
  50, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Clean Coasts Ireland');

INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Urban Community Gardens',
  'Environment',
  'Urban Ireland',
  'Create and maintain community gardens in urban areas across Ireland — providing fresh produce, green spaces and bringing communities together through growing food.',
  'Growing food, growing community',
  '🌱', false, 10000, '₮', 'UG',
  'linear-gradient(135deg,#34d399,#059669)',
  ARRAY['Urban','Gardens','Community']::text[],
  ARRAY[2,11,15]::int[],
  51, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Urban Community Gardens');

-- Elderly & Isolation
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Combat Loneliness in Older People',
  'Elderly Care',
  'Ireland',
  'Support community programmes that tackle loneliness and social isolation among elderly people in Ireland — befriending services, community hubs and digital literacy classes.',
  'No older person should feel alone',
  '👴', false, 20000, '₮', 'OL',
  'linear-gradient(135deg,#fb923c,#ea580c)',
  ARRAY['Elderly','Isolation','Community']::text[],
  ARRAY[3,10]::int[],
  60, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Combat Loneliness in Older People');

-- Disability & Inclusion
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Disability Inclusion Fund',
  'Disability',
  'Ireland',
  'Support organisations providing services, equipment and opportunities for people with disabilities in Ireland — making communities more accessible and inclusive for everyone.',
  'Inclusion is not optional — it is essential',
  '♿', false, 25000, '₮', 'DI',
  'linear-gradient(135deg,#38bdf8,#6366f1)',
  ARRAY['Disability','Inclusion','Accessibility']::text[],
  ARRAY[3,10]::int[],
  70, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Disability Inclusion Fund');

-- Rural Ireland
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Rural Community Development',
  'Rural Development',
  'Rural Ireland',
  'Support rural communities across Ireland facing depopulation, lack of services and economic decline — funding local initiatives, broadband access and community infrastructure.',
  'Strong rural communities make a strong Ireland',
  '🌾', false, 30000, '₮', 'RC',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  ARRAY['Rural','Community','Development']::text[],
  ARRAY[8,11]::int[],
  80, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Rural Community Development');

-- Refugees & New Communities
INSERT INTO public.impact_projects
  (name, category, location, description, impact_headline, emoji, featured, goal, currency, avatar_initials, avatar_gradient, tags, sdgs, sort_order, status)
SELECT
  'Welcome & Integration Fund',
  'Integration',
  'Ireland',
  'Support refugees and new communities arriving in Ireland — language classes, legal aid, housing support and community integration programmes helping people rebuild their lives.',
  'Ireland has always been a place of welcome',
  '🤝', false, 20000, '₮', 'WI',
  'linear-gradient(135deg,#34d399,#38bdf8)',
  ARRAY['Refugees','Integration','Welcome']::text[],
  ARRAY[10,16]::int[],
  90, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.impact_projects WHERE name = 'Welcome & Integration Fund');

-- ── 3. cause_suggestions table ──────────────────────────────────────────────
-- Receives submissions from the "Suggest a Cause" form at the bottom
-- of /impact. Authenticated users leave their user_id + email from
-- the profile; anons can submit with just the form fields + optional
-- email. Status starts as 'pending' — admin reviews via dashboard
-- and moves to 'approved' / 'rejected'.
CREATE TABLE IF NOT EXISTS public.cause_suggestions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  description   text        NOT NULL,
  category      text,
  email         text,
  status        text        NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes  text
);

CREATE INDEX IF NOT EXISTS cause_suggestions_status_idx
  ON public.cause_suggestions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS cause_suggestions_user_idx
  ON public.cause_suggestions (user_id);

ALTER TABLE public.cause_suggestions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a suggestion (anon or authenticated). Each row
-- carries its own user_id; the /api/impact/suggest route uses the
-- admin client for the insert so RLS doesn't need to permit it, but
-- we grant the INSERT policy too as belt-and-braces.
DROP POLICY IF EXISTS "Anyone can submit suggestion" ON public.cause_suggestions;
CREATE POLICY "Anyone can submit suggestion"
  ON public.cause_suggestions FOR INSERT
  WITH CHECK (true);

-- Users can see their own suggestions. Admin reads via service role
-- (which bypasses RLS automatically).
DROP POLICY IF EXISTS "Users read own suggestions" ON public.cause_suggestions;
CREATE POLICY "Users read own suggestions"
  ON public.cause_suggestions FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.cause_suggestions TO authenticated, anon;

-- ── 4. Reload PostgREST schema cache ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
