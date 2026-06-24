-- Experience Pubs community section
-- Applied to FreeTrust Supabase project ref: tioqakxnqjxyuzgnwhrb
-- Do not apply to Sales AI One project ref: smttyfjcleqnxexfjgkx.

CREATE TABLE IF NOT EXISTS pubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text DEFAULT 'Cork',
  country text DEFAULT 'IE',
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  google_place_id text UNIQUE,
  phone text,
  website text,
  opening_hours jsonb,
  is_verified boolean DEFAULT false,
  avg_rating numeric(3,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pub_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pub_id uuid REFERENCES pubs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  activity_type text CHECK (activity_type IN ('casual_pints','trad_session','quiz_night','sport_watch','live_music','after_work','celebration','other')),
  scheduled_at timestamptz NOT NULL,
  max_attendees int DEFAULT 20,
  is_open_to_all boolean DEFAULT true,
  status text DEFAULT 'active' CHECK (status IN ('active','cancelled','completed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pub_activity_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES pub_activities(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'going' CHECK (status IN ('going','maybe','declined')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS pub_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES pub_activities(id) ON DELETE CASCADE,
  pub_id uuid REFERENCES pubs(id) ON DELETE CASCADE,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, activity_id)
);

ALTER TABLE pubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pub_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pub_activity_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE pub_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Pubs are publicly readable" ON pubs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Activities are publicly readable" ON pub_activities FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can create activities" ON pub_activities FOR INSERT WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Creator can update their activity" ON pub_activities FOR UPDATE USING (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Attendees readable by all" ON pub_activity_attendees FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage their own attendance" ON pub_activity_attendees FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Invites visible to sender and recipient" ON pub_invites FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can send invites" ON pub_invites FOR INSERT WITH CHECK (auth.uid() = from_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Recipient can update invite status" ON pub_invites FOR UPDATE USING (auth.uid() = to_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO pubs (name, address, lat, lng, is_verified, avg_rating)
SELECT v.name, v.address, v.lat::numeric, v.lng::numeric, v.is_verified, v.avg_rating::numeric
FROM (VALUES
  ('Sin É', 'Coburg St, Cork', 51.9016, -8.4653, true, 4.7),
  ('Cork Public House', 'MacCurtain St, Cork', 51.9032, -8.4618, false, 4.5),
  ('The Franciscan Well Brewery', 'North Mall, Cork', 51.9028, -8.4802, true, 4.6),
  ('The Crane Lane Theatre', 'Phoenix St, Cork', 51.8985, -8.4701, false, 4.8),
  ('The Mutton Lane Inn', 'Mutton Lane, Cork', 51.8978, -8.4714, false, 4.4),
  ('Bodega', 'Cornmarket St, Cork', 51.8982, -8.4743, false, 4.3),
  ('Porter House', 'Oliver Plunkett St, Cork', 51.8976, -8.4698, false, 4.2),
  ('An Spailpín Fánach', 'South Main St, Cork', 51.8959, -8.4723, true, 4.6)
) AS v(name, address, lat, lng, is_verified, avg_rating)
WHERE NOT EXISTS (
  SELECT 1 FROM pubs p WHERE p.name = v.name AND coalesce(p.address, '') = coalesce(v.address, '')
);
