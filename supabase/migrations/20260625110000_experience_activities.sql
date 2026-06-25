-- Experience Activities — FreeTrust community activity platform
-- Uses only activity_* and community_activity_* tables plus auth.users references.

CREATE TABLE IF NOT EXISTS activity_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text DEFAULT 'Cork',
  country text DEFAULT 'IE',
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  google_place_id text UNIQUE,
  venue_type text CHECK (venue_type IN (
    'sports_ground','dance_studio','gym','park','community_hall',
    'swimming_pool','tennis_court','golf_course','yoga_studio',
    'arts_centre','beach','hiking_trail','cycling_route','other'
  )),
  facilities jsonb,
  is_verified boolean DEFAULT false,
  avg_rating numeric(3,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  emoji text NOT NULL,
  colour text NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS community_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES activity_venues(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES activity_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  activity_type text NOT NULL,
  skill_level text DEFAULT 'all' CHECK (skill_level IN ('beginner','intermediate','advanced','all')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  max_attendees int DEFAULT 20,
  min_attendees int DEFAULT 2,
  location_name text,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  is_open_to_all boolean DEFAULT true,
  is_recurring boolean DEFAULT false,
  recurrence_rule text,
  cost_per_person numeric(10,2) DEFAULT 0,
  equipment_provided boolean DEFAULT false,
  equipment_notes text,
  status text DEFAULT 'active' CHECK (status IN ('active','cancelled','completed','draft')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_activity_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES community_activities(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'going' CHECK (status IN ('going','maybe','declined','waitlist')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_activity_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES community_activities(id) ON DELETE CASCADE,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, activity_id)
);

CREATE TABLE IF NOT EXISTS community_activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES community_activities(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_activity_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_activity_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_activity_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_venues' AND policyname = 'Venues publicly readable') THEN
    CREATE POLICY "Venues publicly readable" ON activity_venues FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_categories' AND policyname = 'Categories publicly readable') THEN
    CREATE POLICY "Categories publicly readable" ON activity_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activities' AND policyname = 'Activities publicly readable') THEN
    CREATE POLICY "Activities publicly readable" ON community_activities FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activities' AND policyname = 'Auth users create activities') THEN
    CREATE POLICY "Auth users create activities" ON community_activities FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activities' AND policyname = 'Creator can update activity') THEN
    CREATE POLICY "Creator can update activity" ON community_activities FOR UPDATE USING (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activity_attendees' AND policyname = 'Attendees readable by all') THEN
    CREATE POLICY "Attendees readable by all" ON community_activity_attendees FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activity_attendees' AND policyname = 'Users manage own attendance') THEN
    CREATE POLICY "Users manage own attendance" ON community_activity_attendees FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activity_invites' AND policyname = 'Invites visible to sender and recipient') THEN
    CREATE POLICY "Invites visible to sender and recipient" ON community_activity_invites FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activity_invites' AND policyname = 'Auth users send invites') THEN
    CREATE POLICY "Auth users send invites" ON community_activity_invites FOR INSERT WITH CHECK (auth.uid() = from_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activity_invites' AND policyname = 'Recipient updates invite') THEN
    CREATE POLICY "Recipient updates invite" ON community_activity_invites FOR UPDATE USING (auth.uid() = to_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activity_comments' AND policyname = 'Comments publicly readable') THEN
    CREATE POLICY "Comments publicly readable" ON community_activity_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_activity_comments' AND policyname = 'Auth users post comments') THEN
    CREATE POLICY "Auth users post comments" ON community_activity_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

INSERT INTO activity_categories (name, emoji, colour, sort_order) VALUES
  ('Sport',           '⚽', '#C97D2E', 1),
  ('Dancing',         '💃', '#9B59B6', 2),
  ('Fitness',         '🏋️', '#E74C3C', 3),
  ('Outdoor',         '🥾', '#27AE60', 4),
  ('Arts & Crafts',   '🎨', '#3498DB', 5),
  ('Music',           '🎸', '#F39C12', 6),
  ('Wellbeing',       '🧘', '#1ABC9C', 7),
  ('Social Games',    '🎲', '#E67E22', 8),
  ('Water Sports',    '🏄', '#2980B9', 9),
  ('Cycling',         '🚴', '#16A085', 10),
  ('Running',         '🏃', '#D35400', 11),
  ('Volunteering',    '🤝', '#8E44AD', 12)
ON CONFLICT (name) DO NOTHING;

INSERT INTO activity_venues (name, address, lat, lng, venue_type, is_verified, avg_rating)
SELECT v.name, v.address, v.lat, v.lng, v.venue_type, v.is_verified, v.avg_rating
FROM (VALUES
  ('Páirc Uí Chaoimh', 'Centre Park Rd, Cork', 51.8892::numeric, -8.4527::numeric, 'sports_ground', true, 4.8::numeric),
  ('Cork Athletics Stadium', 'Bishopstown, Cork', 51.8836::numeric, -8.5201::numeric, 'sports_ground', true, 4.5::numeric),
  ('Fitzgerald Park', 'Mardyke, Cork', 51.8998::numeric, -8.4883::numeric, 'park', true, 4.7::numeric),
  ('The Mardyke Arena', 'Mardyke Walk, Cork', 51.8990::numeric, -8.4896::numeric, 'gym', true, 4.6::numeric),
  ('Cork City Hall Plaza', 'Anglesea St, Cork', 51.8976::numeric, -8.4741::numeric, 'community_hall', false, 4.3::numeric),
  ('Blackrock Castle', 'Castle Rd, Blackrock', 51.8882::numeric, -8.4235::numeric, 'other', true, 4.9::numeric),
  ('Lee Valley Greenway', 'Carrigrohane, Cork', 51.8950::numeric, -8.5800::numeric, 'cycling_route', false, 4.6::numeric),
  ('Sunday Well Tennis Club', 'Sunday Well Rd, Cork', 51.9041::numeric, -8.4892::numeric, 'tennis_court', false, 4.4::numeric),
  ('Cork City Yoga Studio', 'Paul St, Cork', 51.8999::numeric, -8.4742::numeric, 'yoga_studio', false, 4.5::numeric),
  ('Triskel Arts Centre', 'Tobin St, Cork', 51.8977::numeric, -8.4769::numeric, 'arts_centre', true, 4.7::numeric)
) AS v(name, address, lat, lng, venue_type, is_verified, avg_rating)
WHERE NOT EXISTS (
  SELECT 1 FROM activity_venues existing
  WHERE lower(existing.name) = lower(v.name)
    AND coalesce(existing.address, '') = coalesce(v.address, '')
);
