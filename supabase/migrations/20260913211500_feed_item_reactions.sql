-- Reactions for feed items that are composed from side tables rather than
-- feed_posts (currently published articles and active service listings).
-- feed_reactions.post_id intentionally remains foreign-keyed to feed_posts;
-- this table keeps that integrity constraint while supporting the unified feed.

create table if not exists feed_item_reactions (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('article', 'service')),
  item_id uuid not null,
  user_id uuid not null references profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('trust', 'love', 'insightful', 'collab')),
  posted_as_organisation_id uuid references organisations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_feed_item_reactions_item
  on feed_item_reactions(item_type, item_id);

create index if not exists idx_feed_item_reactions_user
  on feed_item_reactions(user_id);

create index if not exists idx_feed_item_reactions_posted_as_org
  on feed_item_reactions(posted_as_organisation_id);

create unique index if not exists feed_item_reactions_personal_identity_key
  on feed_item_reactions(item_type, item_id, user_id)
  where posted_as_organisation_id is null;

create unique index if not exists feed_item_reactions_org_identity_key
  on feed_item_reactions(item_type, item_id, user_id, posted_as_organisation_id)
  where posted_as_organisation_id is not null;

alter table feed_item_reactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'feed_item_reactions' and policyname = 'Feed item reactions are public') then
    create policy "Feed item reactions are public"
      on feed_item_reactions for select
      using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'feed_item_reactions' and policyname = 'Users insert own feed item reactions') then
    create policy "Users insert own feed item reactions"
      on feed_item_reactions for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'feed_item_reactions' and policyname = 'Users update own feed item reactions') then
    create policy "Users update own feed item reactions"
      on feed_item_reactions for update
      using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'feed_item_reactions' and policyname = 'Users delete own feed item reactions') then
    create policy "Users delete own feed item reactions"
      on feed_item_reactions for delete
      using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'feed_item_reactions' and policyname = 'Service role manages feed item reactions') then
    create policy "Service role manages feed item reactions"
      on feed_item_reactions for all
      using (auth.role() = 'service_role');
  end if;
end $$;
