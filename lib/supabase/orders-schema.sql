-- Orders table for escrow-based transactions
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references auth.users(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  item_type text not null check (item_type in ('service', 'product')),
  item_id uuid not null,
  item_title text not null,
  amount_pence integer not null,
  platform_fee_pence integer not null,
  seller_payout_pence integer not null,
  status text default 'pending_escrow' check (
    status in ('pending_escrow', 'in_progress', 'delivered', 'completed', 'disputed', 'refunded')
  ),
  stripe_session_id text,
  stripe_payment_intent text,
  delivery_notes text,
  dispute_reason text,
  escrow_released_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table orders enable row level security;

-- Buyers can see their own orders
create policy "Buyers see own orders" on orders
  for select using (auth.uid() = buyer_id);

-- Sellers can see their own orders
create policy "Sellers see own orders" on orders
  for select using (auth.uid() = seller_id);

-- Buyers can update their own orders (release escrow, dispute)
create policy "Buyers update own orders" on orders
  for update using (auth.uid() = buyer_id);

-- Sellers can update their own orders (mark delivered)
create policy "Sellers update own orders" on orders
  for update using (auth.uid() = seller_id);

-- Service role can do everything (for API routes)
create policy "Service role manage" on orders
  for all using (true);

-- Indexes
create index if not exists orders_buyer_idx on orders(buyer_id);
create index if not exists orders_seller_idx on orders(seller_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_stripe_session_idx on orders(stripe_session_id);

-- Updated at trigger
create or replace function update_orders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on orders
  for each row execute function update_orders_updated_at();
