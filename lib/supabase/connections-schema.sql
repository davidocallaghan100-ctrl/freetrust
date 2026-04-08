-- ============================================================
-- FreeTrust Connections / Follows Schema
-- ============================================================

-- Connections/follows between users
create table if not exists connections (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'following' check (status in ('following', 'pending', 'blocked')),
  created_at timestamptz not null default now(),
  unique(follower_id, following_id)
);

-- Add follower/following counts to profiles
alter table profiles add column if not exists follower_count integer not null default 0;
alter table profiles add column if not exists following_count integer not null default 0;

-- Indexes
create index if not exists connections_follower_idx on connections(follower_id);
create index if not exists connections_following_idx on connections(following_id);

-- RLS
alter table connections enable row level security;
create policy "Connections are viewable by all" on connections for select using (true);
create policy "Users can follow" on connections for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on connections for delete using (auth.uid() = follower_id);
create policy "Users can update own connections" on connections for update using (auth.uid() = follower_id);

-- Auto-increment follower/following counts
create or replace function increment_connection_counts() returns trigger as $$
begin
  update profiles set following_count = following_count + 1 where id = NEW.follower_id;
  update profiles set follower_count = follower_count + 1 where id = NEW.following_id;
  return NEW;
end; $$ language plpgsql security definer;

create trigger on_connection_created after insert on connections
  for each row execute function increment_connection_counts();

create or replace function decrement_connection_counts() returns trigger as $$
begin
  update profiles set following_count = greatest(following_count - 1, 0) where id = OLD.follower_id;
  update profiles set follower_count = greatest(follower_count - 1, 0) where id = OLD.following_id;
  return OLD;
end; $$ language plpgsql security definer;

create trigger on_connection_removed after delete on connections
  for each row execute function decrement_connection_counts();
