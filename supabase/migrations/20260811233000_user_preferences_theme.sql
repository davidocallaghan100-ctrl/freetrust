-- =============================================================================
-- User display preferences: theme (and future display settings)
-- One row per user. theme defaults to 'dark' so no existing/new user's
-- experience changes unless they explicitly opt into light mode.
--
-- NOTE: a `user_preferences` table already existed in production (created for
-- a `locale` preference, columns: id uuid pk, user_id uuid unique fk ->
-- auth.users, locale text, created_at, updated_at). This migration is
-- written to work whether the table already exists (adds the `theme` column)
-- or doesn't (creates it fresh with the same shape), so it's safe to re-run
-- on any environment.
-- =============================================================================

create table if not exists user_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  locale     text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_preferences
  add column if not exists theme text not null default 'dark';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_theme_check'
  ) then
    alter table user_preferences
      add constraint user_preferences_theme_check check (theme in ('dark', 'light'));
  end if;
end $$;

comment on column user_preferences.theme is
  'dark (default) | light — synced from the client ThemeContext so the
   choice follows the user across devices.';

alter table user_preferences enable row level security;

-- Users can view their own preferences
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_preferences' and policyname='Users view own preferences') then
    create policy "Users view own preferences"
      on user_preferences for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Users can upsert their own preferences
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_preferences' and policyname='Users insert own preferences') then
    create policy "Users insert own preferences"
      on user_preferences for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_preferences' and policyname='Users update own preferences') then
    create policy "Users update own preferences"
      on user_preferences for update
      using (auth.uid() = user_id);
  end if;
  -- Service role can do anything
  if not exists (select 1 from pg_policies where tablename='user_preferences' and policyname='Service role manages preferences') then
    create policy "Service role manages preferences"
      on user_preferences for all
      using (auth.role() = 'service_role');
  end if;
end $$;
