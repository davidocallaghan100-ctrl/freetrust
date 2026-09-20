-- Comments for newsfeed items that are composed from side tables rather than
-- feed_posts (currently published articles and active service listings).
-- feed_comments.post_id intentionally remains foreign-keyed to feed_posts;
-- this table keeps that integrity constraint while supporting the unified feed.

create table if not exists public.feed_item_comments (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('article', 'service')),
  item_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 500),
  posted_as_organisation_id uuid references public.organisations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feed_item_comments_item
  on public.feed_item_comments(item_type, item_id, created_at);

create index if not exists idx_feed_item_comments_user
  on public.feed_item_comments(user_id);

create index if not exists idx_feed_item_comments_posted_as_org
  on public.feed_item_comments(posted_as_organisation_id);

-- Comment likes need their own table because feed_comment_likes.comment_id is
-- correctly foreign-keyed to feed_comments and cannot point at side-table IDs.
create table if not exists public.feed_item_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.feed_item_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists idx_feed_item_comment_likes_comment
  on public.feed_item_comment_likes(comment_id);

create index if not exists idx_feed_item_comment_likes_user
  on public.feed_item_comment_likes(user_id);

alter table public.feed_item_comments enable row level security;
alter table public.feed_item_comment_likes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comments'
      and policyname = 'Feed item comments are public'
  ) then
    create policy "Feed item comments are public"
      on public.feed_item_comments for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comments'
      and policyname = 'Users insert own feed item comments'
  ) then
    create policy "Users insert own feed item comments"
      on public.feed_item_comments for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comments'
      and policyname = 'Users update own feed item comments'
  ) then
    create policy "Users update own feed item comments"
      on public.feed_item_comments for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comments'
      and policyname = 'Users delete own feed item comments'
  ) then
    create policy "Users delete own feed item comments"
      on public.feed_item_comments for delete
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comments'
      and policyname = 'Service role manages feed item comments'
  ) then
    create policy "Service role manages feed item comments"
      on public.feed_item_comments for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comment_likes'
      and policyname = 'Feed item comment likes are public'
  ) then
    create policy "Feed item comment likes are public"
      on public.feed_item_comment_likes for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comment_likes'
      and policyname = 'Users insert own feed item comment likes'
  ) then
    create policy "Users insert own feed item comment likes"
      on public.feed_item_comment_likes for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comment_likes'
      and policyname = 'Users delete own feed item comment likes'
  ) then
    create policy "Users delete own feed item comment likes"
      on public.feed_item_comment_likes for delete
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_item_comment_likes'
      and policyname = 'Service role manages feed item comment likes'
  ) then
    create policy "Service role manages feed item comment likes"
      on public.feed_item_comment_likes for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
