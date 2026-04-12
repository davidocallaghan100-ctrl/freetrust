-- =============================================================================
-- Defensive signup triggers — never block auth.users inserts
--
-- Symptom being fixed:
--   New user signup fails with "Database error saving new user" /
--   "unexpected_failure" which the register page catches and shows as
--   "We're setting things up — please try again in a moment"
--
-- Root cause:
--   When auth.users gets a new row, PostgreSQL fires the on_auth_user_created
--   trigger which runs handle_new_user(). handle_new_user() inserts a row
--   into public.profiles. That INSERT in turn fires BEFORE-INSERT triggers
--   on profiles, including assign_referral_code() (from the referrals
--   migration). If ANY of these steps raise an uncaught exception — a
--   missing column, a missing helper function, a RLS policy rejection,
--   a unique-violation collision, anything — the whole auth.users insert
--   is aborted and Supabase returns "Database error saving new user".
--
-- Fix:
--   Wrap every step of handle_new_user() and assign_referral_code() in
--   BEGIN/EXCEPTION blocks. On any error, raise WARNING (logged to
--   Postgres logs) and fall back to a minimal insert with just id + email.
--   The user gets into the app with a stub profile; they can fill in the
--   rest from the settings page afterwards.
--
-- Run this migration in the Supabase SQL editor. Fully idempotent.
-- =============================================================================

-- ── 1. Ensure the profiles columns the new trigger references all exist ─────
-- Re-running the column adds from the earlier migrations is cheap and
-- guarantees the trigger body below doesn't hit an undefined_column error
-- even if the user skipped or partially ran an earlier migration.
alter table public.profiles
  add column if not exists first_name    text,
  add column if not exists last_name     text,
  add column if not exists referral_code text,
  add column if not exists referred_by   uuid references public.profiles(id) on delete set null;

-- The referral_code UNIQUE constraint may or may not exist depending on
-- migration order. Add it if missing, ignore if it already exists.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname  = 'profiles_referral_code_key'
  ) then
    begin
      alter table public.profiles add constraint profiles_referral_code_key unique (referral_code);
    exception when others then
      raise notice '[defensive migration] skipped unique on referral_code: %', sqlerrm;
    end;
  end if;
end $$;

-- ── 2. Ensure generate_referral_code() exists ───────────────────────────────
-- If the referrals migration hasn't been run yet, the function is missing
-- and assign_referral_code() fails. Define it here as a safety net.
create or replace function public.generate_referral_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..7 loop
    result := result || substr(chars, (floor(random() * length(chars))::int) + 1, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- ── 3. Defensive assign_referral_code ───────────────────────────────────────
-- Never raises. If anything goes wrong, leave referral_code null and log a
-- warning. The code can be set later by the /api/referrals GET endpoint.
create or replace function public.assign_referral_code() returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    begin
      new.referral_code := public.generate_referral_code();
    exception when others then
      raise warning '[assign_referral_code] generation failed: % (%)', sqlerrm, sqlstate;
      new.referral_code := null;
    end;
  end if;
  return new;
exception when others then
  -- Catch-all — never block the insert
  raise warning '[assign_referral_code] unexpected: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;

drop trigger if exists profiles_assign_referral_code on public.profiles;
create trigger profiles_assign_referral_code
  before insert on public.profiles
  for each row execute function public.assign_referral_code();

-- ── 4. Defensive sync_full_name ─────────────────────────────────────────────
-- Same pattern — never block the insert
create or replace function public.sync_full_name() returns trigger
language plpgsql
as $$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := trim(concat_ws(' ', nullif(new.first_name, ''), nullif(new.last_name, '')));
    if new.full_name = '' then new.full_name := null; end if;
  end if;
  return new;
exception when others then
  raise warning '[sync_full_name] %: %', sqlstate, sqlerrm;
  return new;
end;
$$;

drop trigger if exists profiles_sync_full_name on public.profiles;
create trigger profiles_sync_full_name
  before insert or update of first_name, last_name on public.profiles
  for each row execute function public.sync_full_name();

-- ── 5. Defensive handle_new_user ────────────────────────────────────────────
-- This is the critical one — it's called from on_auth_user_created on
-- auth.users INSERT. If it raises, the auth.users INSERT fails and
-- Supabase returns "Database error saving new user" to the client.
--
-- Strategy:
--   1. Try the full insert with first_name/last_name/full_name/email
--   2. If that fails for any reason, fall back to the minimal schema
--      (id + email only — the base columns that have always existed)
--   3. If even the minimal insert fails, log WARNING and return new
--      so the auth.users insert still succeeds. The user can be
--      re-synced later via a backfill.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text;
  meta_last  text;
  meta_full  text;
begin
  meta_first := new.raw_user_meta_data->>'first_name';
  meta_last  := new.raw_user_meta_data->>'last_name';
  meta_full  := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  );

  -- If first/last missing but we have a full name, split it
  if meta_first is null and meta_full is not null then
    meta_first := split_part(meta_full, ' ', 1);
    meta_last  := nullif(regexp_replace(meta_full, '^\S+\s+', ''), meta_full);
  end if;

  -- Attempt 1: full schema insert
  begin
    insert into public.profiles (id, email, first_name, last_name, full_name)
    values (
      new.id,
      new.email,
      meta_first,
      meta_last,
      coalesce(
        meta_full,
        trim(concat_ws(' ', nullif(meta_first, ''), nullif(meta_last, '')))
      )
    )
    on conflict (id) do update
      set
        email      = excluded.email,
        first_name = coalesce(excluded.first_name, public.profiles.first_name),
        last_name  = coalesce(excluded.last_name,  public.profiles.last_name),
        full_name  = coalesce(excluded.full_name,  public.profiles.full_name);
    return new;
  exception when others then
    raise warning '[handle_new_user] full insert failed, falling back: % (%)', sqlerrm, sqlstate;
  end;

  -- Attempt 2: minimal insert (id + email only)
  begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
    return new;
  exception when others then
    raise warning '[handle_new_user] minimal insert also failed: % (%)', sqlerrm, sqlstate;
  end;

  -- Attempt 3: give up on the profile row but let auth.users insert proceed.
  -- The profiles row will be backfilled by /api/directory/members (which
  -- already has a backfill loop) the first time the user hits the directory.
  return new;
exception when others then
  -- Catch-all safety net — we NEVER want to block auth.users inserts
  raise warning '[handle_new_user] catch-all: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;

-- Re-create the trigger so it picks up the new function body
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 6. Ensure the profiles RLS insert policy exists for the trigger ─────────
-- handle_new_user() is SECURITY DEFINER so it runs with the function owner's
-- privileges (usually postgres), which bypasses RLS. But if someone has
-- mis-configured the function owner, we need an explicit INSERT policy.
-- Services that use the service role key bypass RLS anyway.
alter table public.profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Service role can insert profiles'
  ) then
    create policy "Service role can insert profiles"
      on public.profiles for insert
      with check (true);
  end if;
end $$;

-- ── 7. Self-test — verify the triggers are wired and active ────────────────
do $$
declare
  has_handle_trigger boolean;
  has_referral_trigger boolean;
  has_sync_trigger boolean;
begin
  select exists(
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) into has_handle_trigger;
  select exists(
    select 1 from pg_trigger where tgname = 'profiles_assign_referral_code'
  ) into has_referral_trigger;
  select exists(
    select 1 from pg_trigger where tgname = 'profiles_sync_full_name'
  ) into has_sync_trigger;

  raise notice '[defensive migration] on_auth_user_created installed: %', has_handle_trigger;
  raise notice '[defensive migration] profiles_assign_referral_code installed: %', has_referral_trigger;
  raise notice '[defensive migration] profiles_sync_full_name installed: %', has_sync_trigger;
end $$;
