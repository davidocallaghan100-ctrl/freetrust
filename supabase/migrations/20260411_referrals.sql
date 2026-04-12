-- =============================================================================
-- Referral system: referrals table + profiles.referral_code / referred_by
-- =============================================================================

-- ── 1. Add referral columns to profiles ──────────────────────────────────────
alter table profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by   uuid references profiles(id) on delete set null;

create index if not exists idx_profiles_referral_code on profiles(referral_code);
create index if not exists idx_profiles_referred_by on profiles(referred_by);

-- ── 2. Referrals table (one row per (referrer, referred) pair) ───────────────
create table if not exists referrals (
  id              uuid primary key default gen_random_uuid(),
  referrer_id     uuid not null references profiles(id) on delete cascade,
  referred_id     uuid not null references profiles(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'completed')),
  reward_credited boolean not null default false,
  reward_amount   integer not null default 50,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),

  unique (referred_id),                                  -- a user can only be referred once
  constraint no_self_referral check (referrer_id <> referred_id)
);

create index if not exists idx_referrals_referrer on referrals(referrer_id);
create index if not exists idx_referrals_status   on referrals(status);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
alter table referrals enable row level security;

-- Users can see their own referrals (as referrer or referred)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='referrals' and policyname='Users can view own referrals') then
    create policy "Users can view own referrals"
      on referrals for select
      using (auth.uid() = referrer_id or auth.uid() = referred_id);
  end if;
end $$;

-- Only service role inserts / updates (API routes handle it)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='referrals' and policyname='Service role manages referrals') then
    create policy "Service role manages referrals"
      on referrals for all
      using (auth.role() = 'service_role');
  end if;
end $$;

-- ── 4. Generate referral codes for existing users ────────────────────────────
-- 7-char alphanumeric code (removes ambiguous chars like 0/O, 1/I/l)
create or replace function generate_referral_code() returns text as $$
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

-- Backfill codes for existing users who don't have one
do $$
declare
  u record;
  new_code text;
  attempts integer;
begin
  for u in select id from profiles where referral_code is null loop
    attempts := 0;
    loop
      new_code := generate_referral_code();
      begin
        update profiles set referral_code = new_code where id = u.id;
        exit;
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts > 10 then
          -- extremely unlikely — prepend user id fragment to guarantee uniqueness
          update profiles set referral_code = new_code || substr(u.id::text, 1, 4) where id = u.id;
          exit;
        end if;
      end;
    end loop;
  end loop;
end $$;

-- ── 5. Trigger to auto-assign referral code to new profiles ──────────────────
create or replace function assign_referral_code() returns trigger as $$
declare
  new_code text;
  attempts integer := 0;
begin
  if new.referral_code is not null then
    return new;
  end if;
  loop
    new_code := generate_referral_code();
    begin
      new.referral_code := new_code;
      return new;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 10 then
        new.referral_code := new_code || substr(new.id::text, 1, 4);
        return new;
      end if;
    end;
  end loop;
end;
$$ language plpgsql;

drop trigger if exists profiles_assign_referral_code on profiles;
create trigger profiles_assign_referral_code
  before insert on profiles
  for each row execute function assign_referral_code();
