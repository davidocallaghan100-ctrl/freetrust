-- Impact projects table
CREATE TABLE IF NOT EXISTS impact_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  location text NOT NULL,
  description text,
  impact_headline text,
  source text,
  sdgs int[],
  tags text[],
  avatar_initials text,
  avatar_gradient text,
  raised numeric DEFAULT 0,
  goal numeric NOT NULL,
  currency text DEFAULT '€',
  backers int DEFAULT 0,
  status text DEFAULT 'active',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Impact donations table
CREATE TABLE IF NOT EXISTS impact_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES impact_projects(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Community cause votes (one per user per quarter)
CREATE TABLE IF NOT EXISTS impact_cause_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  cause_id text NOT NULL,
  quarter text NOT NULL DEFAULT to_char(now(), 'YYYY-"Q"Q'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quarter)
);

-- Seed the 6 real projects
INSERT INTO impact_projects (name, category, location, description, impact_headline, source, sdgs, tags, avatar_initials, avatar_gradient, raised, goal, currency, backers, sort_order)
VALUES
  (
    'Great Rift Valley Reforestation',
    'Reforestation',
    'Kenya & Tanzania',
    'Restoring degraded land across the Great Rift Valley through community-led tree planting and agroforestry. Partnered with One Tree Planted, who planted 51.9M trees across 394 projects in 72 countries in 2023 alone.',
    '51.9M trees planted in 2023',
    'onetreeplanted.org',
    ARRAY[13,15,1],
    ARRAY['Trees','Community','Livelihoods'],
    'GR',
    'linear-gradient(135deg,#34d399,#059669)',
    142800, 200000, '€', 1840, 1
  ),
  (
    'Solar for Schools – West Africa',
    'Clean Energy',
    'Ghana & Senegal',
    'Installing solar panels in schools across rural West Africa. 32% of African primary schools operate off-grid — solar electrification improves learning outcomes and reduces CO₂ emissions.',
    '500,000+ African schools mapped for solar',
    'joint-research-centre.ec.europa.eu',
    ARRAY[4,7,10],
    ARRAY['Solar','Education','Africa'],
    'SS',
    'linear-gradient(135deg,#fbbf24,#d97706)',
    87400, 150000, '€', 934, 2
  ),
  (
    'Pacific Plastic Clean-Up Initiative',
    'Ocean',
    'Pacific Ocean',
    'Supporting The Ocean Cleanup''s System 003 — 3x larger than predecessors, cleaning a football field every 5 seconds. In 2024 they removed 11,500 tonnes of trash, surpassing all prior years combined.',
    '20M kg removed by end 2024',
    'theoceancleanup.com',
    ARRAY[14,12,17],
    ARRAY['Ocean','Plastic','Marine'],
    'PC',
    'linear-gradient(135deg,#38bdf8,#0284c7)',
    203000, 250000, '€', 3200, 3
  ),
  (
    'Seed Libraries Network',
    'Biodiversity',
    'Global',
    'Building a global network of open-source seed libraries to preserve heirloom varieties and support food sovereignty for smallholder farmers worldwide.',
    '2,300 varieties preserved',
    NULL,
    ARRAY[2,15,17],
    ARRAY['Seeds','Biodiversity','Food'],
    'SL',
    'linear-gradient(135deg,#34d399,#38bdf8)',
    41200, 60000, '€', 567, 4
  ),
  (
    'Clean Cookstoves for East Africa',
    'Food Security',
    'Uganda & Rwanda',
    '1 billion people in Africa lack clean cooking. WHO reports 810,000 premature deaths in 2024 from indoor air pollution. One project is delivering 353,000 clean cooking solutions benefiting 1.6M people.',
    '353,000 clean cooking solutions targeted',
    'iea.org / WHO 2024',
    ARRAY[3,7,13],
    ARRAY['Cookstoves','Health','Energy'],
    'CC',
    'linear-gradient(135deg,#fb923c,#ea580c)',
    56700, 80000, '€', 721, 5
  ),
  (
    'Mangrove Restoration Bangladesh',
    'Ocean',
    'Cox''s Bazar, Bangladesh',
    'Restoring mangrove forests to protect coastal communities from flooding and sequester carbon. Mangroves store 3–5x more carbon than tropical forests and protect 18 million people from storm surge globally.',
    '8,000 ha under restoration',
    NULL,
    ARRAY[13,14,15],
    ARRAY['Mangroves','Coastal','Carbon'],
    'MR',
    'linear-gradient(135deg,#38bdf8,#34d399)',
    98000, 120000, '€', 1100, 6
  )
ON CONFLICT DO NOTHING;
