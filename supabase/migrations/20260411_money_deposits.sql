-- money_deposits: wallet top-ups via Stripe
-- This table is written by the API (admin client) and read by both admin and user clients.

create table if not exists money_deposits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  amount_cents  integer not null check (amount_cents > 0),
  currency      text not null default 'eur',
  status        text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  stripe_session_id    text,
  stripe_payment_intent text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for fast lookups by user
create index if not exists idx_money_deposits_user_id on money_deposits(user_id);
create index if not exists idx_money_deposits_stripe_session on money_deposits(stripe_session_id);

-- Enable RLS
alter table money_deposits enable row level security;

-- Users can read their own deposits
create policy "Users can view own deposits"
  on money_deposits for select
  using (auth.uid() = user_id);

-- Only service role (API routes) can insert/update deposits
create policy "Service role manages deposits"
  on money_deposits for all
  using (auth.role() = 'service_role');
