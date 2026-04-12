-- =============================================================================
-- Split full_name into first_name + last_name
-- Adds two new columns to profiles, backfills them from existing full_name
-- by splitting on the first space, and updates handle_new_user() to capture
-- both fields from auth.users.raw_user_meta_data on new signups.
--
-- full_name is kept intact (existing code reads it everywhere) and is
-- automatically kept in sync via a trigger when first_name/last_name change.
-- =============================================================================

-- ── 1. Add columns ──────────────────────────────────────────────────────────
alter table profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- ── 2. Backfill existing rows from full_name ────────────────────────────────
-- Split on the first space: "David O'Callaghan" → first="David", last="O'Callaghan"
-- Single-word names become first_name only, last_name stays null until the
-- user sets it in settings.
update profiles
set
  first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
  last_name  = coalesce(
    last_name,
    nullif(regexp_replace(full_name, '^\S+\s+', ''), full_name)
  )
where full_name is not null
  and (first_name is null or last_name is null);

-- ── 3. Keep full_name in sync with first_name + last_name ───────────────────
-- When a user updates first_name or last_name via the settings page, this
-- trigger re-computes full_name so the rest of the app keeps working.
create or replace function sync_full_name() returns trigger as $$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := trim(concat_ws(' ', nullif(new.first_name, ''), nullif(new.last_name, '')));
    if new.full_name = '' then new.full_name := null; end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_sync_full_name on profiles;
create trigger profiles_sync_full_name
  before insert or update of first_name, last_name on profiles
  for each row execute function sync_full_name();

-- ── 4. Update handle_new_user to capture first_name + last_name ─────────────
-- Reads first_name / last_name / full_name from raw_user_meta_data.
-- If only full_name is provided (legacy or OAuth providers that don't split),
-- splits it the same way the backfill does.
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
end;
$$;

-- Re-create the trigger so it picks up the new function body
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
