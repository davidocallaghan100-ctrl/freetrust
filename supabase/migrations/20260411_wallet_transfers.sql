-- wallet_transfers: peer-to-peer transfers of € balance or ₮ trust tokens

create table if not exists wallet_transfers (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references profiles(id) on delete cascade,
  recipient_id    uuid not null references profiles(id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  currency        text not null check (currency in ('EUR', 'TRUST')),
  note            text default '',
  status          text not null default 'completed' check (status in ('completed', 'failed')),
  created_at      timestamptz not null default now(),

  constraint no_self_transfer check (sender_id <> recipient_id)
);

-- Indexes
create index if not exists idx_wallet_transfers_sender    on wallet_transfers(sender_id);
create index if not exists idx_wallet_transfers_recipient on wallet_transfers(recipient_id);

-- RLS
alter table wallet_transfers enable row level security;

-- Users can see transfers they sent or received
create policy "Users can view own transfers"
  on wallet_transfers for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Only service role can insert (API routes handle validation)
create policy "Service role manages transfers"
  on wallet_transfers for all
  using (auth.role() = 'service_role');
