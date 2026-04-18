-- Track which onboarding emails have been sent to prevent duplicates
create table if not exists public.onboarding_sequence_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null, -- 'welcome', 'first_listing_nudge', 'profile_photo_nudge'
  sent_at timestamptz default now(),
  unique(user_id, email_type)
);

alter table public.onboarding_sequence_log enable row level security;

-- No direct user access needed — managed by service role only
create index if not exists onboarding_sequence_log_user_idx on public.onboarding_sequence_log (user_id);
