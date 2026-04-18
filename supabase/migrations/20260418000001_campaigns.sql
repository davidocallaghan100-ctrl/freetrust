-- campaigns table — outbound email campaign management
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text not null,
  segment text not null default 'all', -- 'all' | 'inactive_7d' | 'inactive_30d' | 'zero_trust' | 'no_purchase'
  status text not null default 'draft', -- 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients integer,
  total_sent integer default 0,
  total_failed integer default 0,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

alter table public.campaigns enable row level security;

-- Only admins can manage campaigns (service role is used for sends)
create policy "admins can manage campaigns" on public.campaigns
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- campaign_sends table — tracks individual per-user sends
create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  user_id uuid references auth.users(id),
  email text not null,
  status text not null default 'pending', -- 'pending' | 'sent' | 'failed'
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.campaign_sends enable row level security;

create policy "admins can view campaign sends" on public.campaign_sends
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Index for segment queries
create index if not exists campaigns_status_idx on public.campaigns (status);
create index if not exists campaign_sends_campaign_idx on public.campaign_sends (campaign_id);
