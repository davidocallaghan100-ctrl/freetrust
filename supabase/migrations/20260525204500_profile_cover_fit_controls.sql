-- Store per-profile cover-photo presentation controls.
-- The original image remains unchanged in Supabase Storage; these values only
-- control how the cover is rendered in the profile banner.

alter table public.profiles
  add column if not exists cover_position_x integer not null default 50,
  add column if not exists cover_position_y integer not null default 50,
  add column if not exists cover_rotation integer not null default 0,
  add column if not exists cover_scale numeric not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cover_position_x_range') then
    alter table public.profiles add constraint profiles_cover_position_x_range check (cover_position_x between 0 and 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cover_position_y_range') then
    alter table public.profiles add constraint profiles_cover_position_y_range check (cover_position_y between 0 and 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cover_rotation_quarter_turn') then
    alter table public.profiles add constraint profiles_cover_rotation_quarter_turn check (cover_rotation in (0, 90, 180, 270)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cover_scale_range') then
    alter table public.profiles add constraint profiles_cover_scale_range check (cover_scale >= 1 and cover_scale <= 2) not valid;
  end if;
end $$;
