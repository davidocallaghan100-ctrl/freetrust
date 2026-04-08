-- ============================================================
-- FreeTrust Community Platform Schema
-- ============================================================

-- Communities
create table if not exists communities (
  id               uuid primary key default uuid_generate_v4(),
  owner_id         uuid references profiles(id) on delete cascade not null,
  name             text not null,
  slug             text not null unique,
  description      text not null default '',
  avatar_initials  text not null default '',
  avatar_gradient  text not null default 'linear-gradient(135deg,#38bdf8,#0284c7)',
  category         text not null default 'General',
  tags             text[] not null default '{}',
  is_paid          boolean not null default false,
  price_monthly    numeric(10,2) not null default 0,
  stripe_price_id  text,
  member_count     integer not null default 0,
  post_count       integer not null default 0,
  is_featured      boolean not null default false,
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Community Members
create table if not exists community_members (
  id             uuid primary key default uuid_generate_v4(),
  community_id   uuid references communities(id) on delete cascade not null,
  user_id        uuid references profiles(id) on delete cascade not null,
  role           text not null default 'member' check (role in ('member','moderator','owner')),
  tier           text not null default 'free',
  joined_at      timestamptz not null default now(),
  unique(community_id, user_id)
);

-- Community Posts
create table if not exists community_posts (
  id             uuid primary key default uuid_generate_v4(),
  community_id   uuid references communities(id) on delete cascade not null,
  author_id      uuid references profiles(id) on delete cascade not null,
  title          text not null,
  body           text not null default '',
  type           text not null default 'discussion' check (type in ('discussion','announcement','question')),
  upvotes        integer not null default 0,
  comment_count  integer not null default 0,
  is_pinned      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Community Post Votes
create table if not exists community_post_votes (
  id           uuid primary key default uuid_generate_v4(),
  post_id      uuid references community_posts(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete cascade not null,
  created_at   timestamptz not null default now(),
  unique(post_id, user_id)
);

-- Community Comments
create table if not exists community_comments (
  id           uuid primary key default uuid_generate_v4(),
  post_id      uuid references community_posts(id) on delete cascade not null,
  author_id    uuid references profiles(id) on delete cascade not null,
  body         text not null,
  upvotes      integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Community Courses
create table if not exists community_courses (
  id             uuid primary key default uuid_generate_v4(),
  community_id   uuid references communities(id) on delete cascade not null,
  title          text not null,
  description    text not null default '',
  lesson_count   integer not null default 0,
  is_published   boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Community Lessons
create table if not exists community_lessons (
  id           uuid primary key default uuid_generate_v4(),
  course_id    uuid references community_courses(id) on delete cascade not null,
  title        text not null,
  body         text not null default '',
  video_url    text,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Community Events
create table if not exists community_events (
  id              uuid primary key default uuid_generate_v4(),
  community_id    uuid references communities(id) on delete cascade not null,
  title           text not null,
  description     text not null default '',
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  is_online       boolean not null default true,
  meeting_url     text,
  attendee_count  integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Community Event Attendees
create table if not exists community_event_attendees (
  id           uuid primary key default uuid_generate_v4(),
  event_id     uuid references community_events(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete cascade not null,
  created_at   timestamptz not null default now(),
  unique(event_id, user_id)
);

-- ============================================================
-- RLS Policies
-- ============================================================

alter table communities enable row level security;
alter table community_members enable row level security;
alter table community_posts enable row level security;
alter table community_post_votes enable row level security;
alter table community_comments enable row level security;
alter table community_courses enable row level security;
alter table community_lessons enable row level security;
alter table community_events enable row level security;
alter table community_event_attendees enable row level security;

-- Communities: public read, owner full control
create policy "Communities are publicly viewable" on communities for select using (true);
create policy "Authenticated users can create communities" on communities for insert with check (auth.uid() = owner_id);
create policy "Owners can update their communities" on communities for update using (auth.uid() = owner_id);
create policy "Owners can delete their communities" on communities for delete using (auth.uid() = owner_id);

-- Community members: members can see each other, authenticated users can join
create policy "Members are viewable" on community_members for select using (true);
create policy "Authenticated users can join" on community_members for insert with check (auth.uid() = user_id);
create policy "Members can leave" on community_members for delete using (auth.uid() = user_id);
create policy "Owners can manage members" on community_members for update using (
  exists (select 1 from community_members cm where cm.community_id = community_id and cm.user_id = auth.uid() and cm.role = 'owner')
);

-- Community posts: publicly readable, members can post
create policy "Posts are publicly viewable" on community_posts for select using (true);
create policy "Members can create posts" on community_posts for insert with check (
  auth.uid() = author_id and
  exists (select 1 from community_members cm where cm.community_id = community_id and cm.user_id = auth.uid())
);
create policy "Authors can update posts" on community_posts for update using (auth.uid() = author_id);
create policy "Authors can delete posts" on community_posts for delete using (auth.uid() = author_id);

-- Post votes
create policy "Votes are viewable" on community_post_votes for select using (true);
create policy "Authenticated users can vote" on community_post_votes for insert with check (auth.uid() = user_id);
create policy "Users can remove own votes" on community_post_votes for delete using (auth.uid() = user_id);

-- Comments
create policy "Comments are publicly viewable" on community_comments for select using (true);
create policy "Members can comment" on community_comments for insert with check (auth.uid() = author_id);
create policy "Authors can delete comments" on community_comments for delete using (auth.uid() = author_id);

-- Courses
create policy "Courses are viewable by members" on community_courses for select using (true);
create policy "Owners can manage courses" on community_courses for insert with check (
  exists (select 1 from community_members cm where cm.community_id = community_id and cm.user_id = auth.uid() and cm.role in ('owner','moderator'))
);
create policy "Owners can update courses" on community_courses for update using (
  exists (select 1 from communities c where c.id = community_id and c.owner_id = auth.uid())
);

-- Lessons
create policy "Lessons are viewable" on community_lessons for select using (true);
create policy "Owners can manage lessons" on community_lessons for insert with check (
  exists (
    select 1 from community_courses cc
    join communities c on c.id = cc.community_id
    where cc.id = course_id and c.owner_id = auth.uid()
  )
);

-- Events
create policy "Events are publicly viewable" on community_events for select using (true);
create policy "Owners and mods can create events" on community_events for insert with check (
  exists (select 1 from community_members cm where cm.community_id = community_id and cm.user_id = auth.uid() and cm.role in ('owner','moderator'))
);

-- Event attendees
create policy "Attendees are viewable" on community_event_attendees for select using (true);
create policy "Authenticated users can RSVP" on community_event_attendees for insert with check (auth.uid() = user_id);
create policy "Users can cancel RSVP" on community_event_attendees for delete using (auth.uid() = user_id);

-- ============================================================
-- Functions
-- ============================================================

-- Increment community member count on join
create or replace function increment_community_member_count()
returns trigger as $$
begin
  update communities set member_count = member_count + 1, updated_at = now()
  where id = NEW.community_id;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_community_member_join
  after insert on community_members
  for each row execute procedure increment_community_member_count();

-- Decrement community member count on leave
create or replace function decrement_community_member_count()
returns trigger as $$
begin
  update communities set member_count = greatest(member_count - 1, 0), updated_at = now()
  where id = OLD.community_id;
  return OLD;
end;
$$ language plpgsql security definer;

create trigger on_community_member_leave
  after delete on community_members
  for each row execute procedure decrement_community_member_count();

-- Increment post count on new post
create or replace function increment_community_post_count()
returns trigger as $$
begin
  update communities set post_count = post_count + 1, updated_at = now()
  where id = NEW.community_id;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_community_post_created
  after insert on community_posts
  for each row execute procedure increment_community_post_count();

-- Record 5% FreeTrust platform fee when paid community membership processed
create or replace function record_community_platform_fee(
  p_owner_id   uuid,
  p_amount_gbp numeric,
  p_community_id uuid
) returns void as $$
declare
  fee_amount integer;
begin
  -- 5% fee recorded as negative trust ledger entry (platform revenue)
  fee_amount := floor(p_amount_gbp * 0.05 * 100); -- convert to pence then record
  insert into trust_ledger (user_id, amount, type, reference_id, description)
  values (p_owner_id, -fee_amount, 'platform_fee', p_community_id,
    'FreeTrust 5% platform fee for paid community membership');
end;
$$ language plpgsql security definer;
