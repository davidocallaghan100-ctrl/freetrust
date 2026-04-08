-- Organisations table
create table if not exists organisations (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  type text default 'organisation', -- NGO, Social Enterprise, Co-op, Community Group, etc
  description text,
  mission text,
  logo_url text,
  cover_url text,
  location text,
  website text,
  founded_year integer,
  verified boolean default false,
  follower_count integer default 0,
  member_count integer default 0,
  trust_score integer default 0,
  sdg_goals integer[] default '{}',
  created_at timestamptz default now()
);

alter table organisations enable row level security;

create policy if not exists "Anyone can read organisations"
  on organisations for select using (true);

create policy if not exists "Owners can update organisations"
  on organisations for update using (auth.uid() = owner_id);

create policy if not exists "Authenticated users can create organisations"
  on organisations for insert with check (auth.uid() = owner_id);

-- Organisation follows
create table if not exists organisation_follows (
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references organisations(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, org_id)
);

alter table organisation_follows enable row level security;

create policy if not exists "Users manage own org follows"
  on organisation_follows for all using (auth.uid() = user_id);

-- Organisation team members
create table if not exists organisation_members (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organisations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  avatar_url text,
  linkedin_url text,
  display_order integer default 0,
  created_at timestamptz default now()
);

alter table organisation_members enable row level security;
create policy if not exists "Anyone can read org members" on organisation_members for select using (true);

-- Organisation reviews
create table if not exists organisation_reviews (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organisations(id) on delete cascade not null,
  reviewer_id uuid references auth.users(id) on delete cascade not null,
  reviewer_name text,
  reviewer_avatar text,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  verified boolean default false,
  created_at timestamptz default now(),
  unique(org_id, reviewer_id)
);

alter table organisation_reviews enable row level security;
create policy if not exists "Anyone can read org reviews" on organisation_reviews for select using (true);
create policy if not exists "Authenticated users can create reviews" on organisation_reviews
  for insert with check (auth.uid() = reviewer_id);
