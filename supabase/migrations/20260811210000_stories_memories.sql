-- =============================================================================
-- Stories & Memories feature (approved 2026-08-11)
--
-- Adds: stories, story_views, memories tables + RLS, plus three RPCs:
--   record_story_view(p_story_id)        — dedupe view + increment view_count
--   save_story_as_memory(p_story_id)     — owner saves an expiring story permanently
--   repost_memory_as_story(p_memory_id)  — owner re-adds a saved memory as a fresh 24h story
--
-- Cleanup: implemented as a SQL function `cleanup_expired_stories()` (SECURITY
-- DEFINER) that deletes stale, unsaved, expired stories and RETURNS the
-- deleted rows (id, media_url) so the calling Next.js cron route
-- (/api/cron/stories-cleanup, scheduled daily in vercel.json) can also remove
-- the corresponding objects from the `stories` storage bucket. pg_cron is not
-- enabled on this Supabase project, so we use the same Vercel Cron pattern
-- already used by /api/cron/weekly-digest etc. rather than pg_cron/edge
-- functions, to stay consistent with the rest of the codebase.
--
-- Project ref: tioqakxnqjxyuzgnwhrb (FreeTrust) — do NOT run against any
-- other Supabase project.
-- =============================================================================

-- ── 1. Tables ────────────────────────────────────────────────────────────────

create table if not exists stories (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  media_url        text not null,
  media_type       text not null check (media_type in ('image', 'video')),
  caption          text,
  duration_seconds int not null default 5,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours',
  saved_as_memory  boolean not null default false,
  view_count       int not null default 0,
  -- Set when this story was created via "Repost as Story" from an existing
  -- memory, so the client can show provenance if useful. Nullable — most
  -- stories are original uploads. NOTE: no inline FK here — memories doesn't
  -- exist yet at this point. The FK constraint is added further below, once
  -- memories has been created.
  reposted_from_memory_id uuid
);

alter table stories drop constraint if exists stories_reposted_from_memory_id_fkey;

create table if not exists story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid references stories(id) on delete cascade not null,
  viewer_id  uuid references auth.users(id) on delete cascade not null,
  viewed_at  timestamptz not null default now(),
  unique (story_id, viewer_id)
);

create table if not exists memories (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  story_id            uuid references stories(id) on delete set null,
  media_url           text not null,
  media_type          text not null check (media_type in ('image', 'video')),
  caption             text,
  original_created_at timestamptz not null,
  saved_at            timestamptz not null default now()
);

-- Now that memories exists, wire up the FK we deferred above.
alter table stories
  add constraint stories_reposted_from_memory_id_fkey
  foreign key (reposted_from_memory_id) references memories(id) on delete set null;

create index if not exists idx_stories_user_id on stories(user_id);
create index if not exists idx_stories_expires_at on stories(expires_at);
create index if not exists idx_story_views_story_id on story_views(story_id);
create index if not exists idx_memories_user_id on memories(user_id);
create index if not exists idx_memories_story_id on memories(story_id);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

alter table stories enable row level security;
alter table story_views enable row level security;
alter table memories enable row level security;

-- stories: any authenticated user can see non-expired stories; owners can
-- also see their own expired ones (needed for "Save as Memory" within the
-- 7-day grace window, and for the owner's own story-viewer state).
drop policy if exists "stories select non-expired or own" on stories;
create policy "stories select non-expired or own"
  on stories for select
  to authenticated
  using (expires_at > now() or user_id = auth.uid());

drop policy if exists "stories insert own" on stories;
create policy "stories insert own"
  on stories for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "stories update own" on stories;
create policy "stories update own"
  on stories for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "stories delete own" on stories;
create policy "stories delete own"
  on stories for delete
  to authenticated
  using (user_id = auth.uid());

-- story_views: a viewer can insert their own view row; the story owner can
-- read all views on their own stories (for the viewers-list sheet).
drop policy if exists "story_views insert own" on story_views;
create policy "story_views insert own"
  on story_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

drop policy if exists "story_views select as owner" on story_views;
create policy "story_views select as owner"
  on story_views for select
  to authenticated
  using (
    exists (
      select 1 from stories s
      where s.id = story_views.story_id and s.user_id = auth.uid()
    )
  );

-- memories: public SELECT (memories are a public profile section); only the
-- owner can INSERT/DELETE. There is intentionally no UPDATE policy — memories
-- are immutable snapshots once saved (repost creates a new story, it doesn't
-- edit the memory).
drop policy if exists "memories select all" on memories;
create policy "memories select all"
  on memories for select
  using (true);

drop policy if exists "memories insert own" on memories;
create policy "memories insert own"
  on memories for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "memories delete own" on memories;
create policy "memories delete own"
  on memories for delete
  to authenticated
  using (user_id = auth.uid());

-- ── 3. RPCs ──────────────────────────────────────────────────────────────────

-- record_story_view: idempotent per (story, viewer). Increments view_count
-- only the first time a given viewer sees a given story.
create or replace function record_story_view(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into story_views (story_id, viewer_id)
  values (p_story_id, auth.uid())
  on conflict (story_id, viewer_id) do nothing;

  v_inserted := (found);

  if v_inserted then
    update stories set view_count = view_count + 1 where id = p_story_id;
  end if;
end;
$$;

revoke all on function record_story_view(uuid) from public;
grant execute on function record_story_view(uuid) to authenticated;

-- save_story_as_memory: owner-only. Copies the story into memories and marks
-- the story saved_as_memory = true. Raises if the caller doesn't own the
-- story (this is also enforced defensively even though callers should never
-- reach here for a story they can't see under RLS with a non-owner id, since
-- SECURITY DEFINER functions bypass RLS internally).
create or replace function save_story_as_memory(p_story_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story stories;
  v_memory_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_story from stories where id = p_story_id;

  if v_story.id is null then
    raise exception 'Story not found';
  end if;

  if v_story.user_id <> auth.uid() then
    raise exception 'Not authorized to save this story as a memory';
  end if;

  insert into memories (user_id, story_id, media_url, media_type, caption, original_created_at)
  values (v_story.user_id, v_story.id, v_story.media_url, v_story.media_type, v_story.caption, v_story.created_at)
  returning id into v_memory_id;

  update stories set saved_as_memory = true where id = p_story_id;

  return v_memory_id;
end;
$$;

revoke all on function save_story_as_memory(uuid) from public;
grant execute on function save_story_as_memory(uuid) to authenticated;

-- repost_memory_as_story: owner-only. Creates a brand-new stories row (fresh
-- id, expires_at = now()+24h, view_count = 0, saved_as_memory = false) from
-- an existing memory. Does NOT mutate the memory or any prior story row.
create or replace function repost_memory_as_story(p_memory_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_memory memories;
  v_new_story_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_memory from memories where id = p_memory_id;

  if v_memory.id is null then
    raise exception 'Memory not found';
  end if;

  if v_memory.user_id <> auth.uid() then
    raise exception 'Not authorized to repost this memory';
  end if;

  insert into stories (user_id, media_url, media_type, caption, duration_seconds, expires_at, saved_as_memory, view_count, reposted_from_memory_id)
  values (
    v_memory.user_id,
    v_memory.media_url,
    v_memory.media_type,
    v_memory.caption,
    case when v_memory.media_type = 'image' then 5 else 15 end,
    now() + interval '24 hours',
    false,
    0,
    v_memory.id
  )
  returning id into v_new_story_id;

  return v_new_story_id;
end;
$$;

revoke all on function repost_memory_as_story(uuid) from public;
grant execute on function repost_memory_as_story(uuid) to authenticated;

-- cleanup_expired_stories: called daily by /api/cron/stories-cleanup via the
-- admin (service-role) client. Deletes stories that expired more than 7 days
-- ago (grace window so owners can still "Save as Memory" an expired story)
-- and were never saved. Returns the deleted rows so the caller can also
-- remove the matching objects from the `stories` storage bucket.
create or replace function cleanup_expired_stories()
returns table(id uuid, media_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  delete from stories
  where expires_at < now() - interval '7 days'
    and saved_as_memory = false
  returning stories.id, stories.media_url;
end;
$$;

revoke all on function cleanup_expired_stories() from public;
-- Only the service role should ever invoke this (called by the cron route
-- using the admin client, which uses the service_role key and therefore
-- bypasses grant checks anyway). No authenticated grant on purpose.

-- ── 4. Storage bucket ────────────────────────────────────────────────────────
-- Public read, authenticated write, owner-only delete. Path convention:
-- "<user_id>/<filename>" inside the `stories` bucket (mirrors feed-media's
-- "<kind>/<user_id>/<filename>" pattern, minus the leading kind segment
-- since this bucket is single-purpose).

insert into storage.buckets (id, name, public, file_size_limit)
values ('stories', 'stories', true, 26214400) -- 25MB, matches the app-level reject threshold
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'stories authenticated insert own'
  ) then
    create policy "stories authenticated insert own"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'stories'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'stories public read'
  ) then
    create policy "stories public read"
      on storage.objects for select
      using (bucket_id = 'stories');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'stories owner delete'
  ) then
    create policy "stories owner delete"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'stories'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'stories service role all'
  ) then
    create policy "stories service role all"
      on storage.objects for all
      using (bucket_id = 'stories' and auth.role() = 'service_role');
  end if;
end $$;
