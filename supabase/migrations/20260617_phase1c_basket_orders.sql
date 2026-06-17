-- FreeTrust Products Phase 1C: persistent basket + multi-item product order items.
-- Additive only: does not modify auth.*, products, Sales AI One, voice, call, or entitlement tables.

create or replace function public.update_phase1c_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.basket_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_type text not null check (product_type in ('community', 'external')),
  listing_id uuid references public.listings(id) on delete cascade,
  external_product_id uuid references public.external_product_listings(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basket_items_exactly_one_target check (
    (product_type = 'community' and listing_id is not null and external_product_id is null)
    or
    (product_type = 'external' and external_product_id is not null and listing_id is null)
  )
);

create unique index if not exists basket_items_user_listing_unique
  on public.basket_items(user_id, listing_id)
  where product_type = 'community' and listing_id is not null;

create unique index if not exists basket_items_user_external_unique
  on public.basket_items(user_id, external_product_id)
  where product_type = 'external' and external_product_id is not null;

create index if not exists basket_items_user_idx on public.basket_items(user_id);

alter table public.basket_items enable row level security;

drop policy if exists "Basket owners can read" on public.basket_items;
create policy "Basket owners can read" on public.basket_items
  for select using (auth.uid() = user_id);

drop policy if exists "Basket owners can insert" on public.basket_items;
create policy "Basket owners can insert" on public.basket_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "Basket owners can update" on public.basket_items;
create policy "Basket owners can update" on public.basket_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Basket owners can delete" on public.basket_items;
create policy "Basket owners can delete" on public.basket_items
  for delete using (auth.uid() = user_id);

drop trigger if exists basket_items_updated_at on public.basket_items;
create trigger basket_items_updated_at
  before update on public.basket_items
  for each row execute function public.update_phase1c_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  title text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  seller_payout_cents integer not null default 0 check (seller_payout_cents >= 0),
  stripe_transfer_id text,
  transfer_status text not null default 'pending' check (transfer_status in ('pending', 'created', 'failed')),
  transfer_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_buyer_idx on public.order_items(buyer_id);
create index if not exists order_items_seller_idx on public.order_items(seller_id);
create index if not exists order_items_listing_idx on public.order_items(listing_id);
create index if not exists order_items_transfer_idx on public.order_items(stripe_transfer_id);

-- Compatibility fields for Phase 1C verification/reporting. The existing
-- FreeTrust orders table stores amounts in cents in `amount`; these additive
-- columns expose explicit euro totals without disturbing existing escrow flows.
alter table public.orders add column if not exists total_eur numeric;
alter table public.orders add column if not exists freetrust_fee_eur numeric;

-- Keep `listing_id` as the canonical FreeTrust marketplace reference while
-- also exposing `product_id` for the Phase 1C basket/order-item reporting shape.
alter table public.order_items add column if not exists product_id uuid references public.listings(id) on delete set null;
alter table public.order_items add column if not exists seller_payout_eur numeric;

update public.order_items
set product_id = coalesce(product_id, listing_id),
    seller_payout_eur = coalesce(seller_payout_eur, round((seller_payout_cents::numeric / 100), 2))
where product_id is null or seller_payout_eur is null;

create index if not exists order_items_product_idx on public.order_items(product_id);

alter table public.order_items enable row level security;

drop policy if exists "Order item buyers can read" on public.order_items;
create policy "Order item buyers can read" on public.order_items
  for select using (auth.uid() = buyer_id);

drop policy if exists "Order item sellers can read" on public.order_items;
create policy "Order item sellers can read" on public.order_items
  for select using (auth.uid() = seller_id);

drop trigger if exists order_items_updated_at on public.order_items;
create trigger order_items_updated_at
  before update on public.order_items
  for each row execute function public.update_phase1c_updated_at();
