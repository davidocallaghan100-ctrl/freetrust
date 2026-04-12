-- =============================================================================
-- Multi-type reactions for feed posts
-- Replaces the single boolean "like" with: 👍 trust, ❤️ love, 💡 insightful, 🤝 collab
-- The legacy feed_likes table is kept for backward compat but new code uses
-- feed_reactions exclusively. A user has at most one reaction per post; calling
-- /react with the same type unsets it; calling with a different type updates it.
-- =============================================================================

create table if not exists feed_reactions (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references feed_posts(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('trust', 'love', 'insightful', 'collab')),
  created_at    timestamptz not null default now(),

  unique (post_id, user_id)
);

create index if not exists idx_feed_reactions_post on feed_reactions(post_id);
create index if not exists idx_feed_reactions_user on feed_reactions(user_id);

alter table feed_reactions enable row level security;

-- Anyone can read reactions (so we can show counts and breakdowns)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='feed_reactions' and policyname='Reactions are public') then
    create policy "Reactions are public"
      on feed_reactions for select
      using (true);
  end if;
end $$;

-- Users can react / change / unreact only as themselves
do $$ begin
  if not exists (select 1 from pg_policies where tablename='feed_reactions' and policyname='Users insert own reactions') then
    create policy "Users insert own reactions"
      on feed_reactions for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='feed_reactions' and policyname='Users update own reactions') then
    create policy "Users update own reactions"
      on feed_reactions for update
      using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='feed_reactions' and policyname='Users delete own reactions') then
    create policy "Users delete own reactions"
      on feed_reactions for delete
      using (auth.uid() = user_id);
  end if;
  -- Service role bypass
  if not exists (select 1 from pg_policies where tablename='feed_reactions' and policyname='Service role manages reactions') then
    create policy "Service role manages reactions"
      on feed_reactions for all
      using (auth.role() = 'service_role');
  end if;
end $$;
