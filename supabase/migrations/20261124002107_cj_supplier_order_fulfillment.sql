-- Applied to FreeTrust production with explicit approval on 2026-11-24; retained as the tracked schema source.
alter table public.cj_supplier_catalogue
  add column if not exists tax_policy_approved boolean not null default false,
  add column if not exists compliance_approved boolean not null default false,
  add column if not exists returns_policy_approved boolean not null default false,
  add column if not exists pricing_approved boolean not null default false;

alter table public.cj_supplier_catalogue drop constraint if exists cj_supplier_catalogue_public_guard;
alter table public.cj_supplier_catalogue add constraint cj_supplier_catalogue_public_guard check (
  not is_public or (
    status = 'active' and verified_stock > 0 and inventory_checked_at is not null and shipping_checked_at is not null
    and supplier_unit_cost_usd_cents is not null and shipping_cost_usd_cents is not null
    and landed_cost_eur_cents is not null and retail_price_eur_cents is not null
    and tax_policy_approved and compliance_approved and returns_policy_approved and pricing_approved
  )
);

create table if not exists public.cj_supplier_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  catalogue_id uuid not null references public.cj_supplier_catalogue(id) on delete restrict,
  cj_order_number text not null unique,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency = 'eur'),
  status text not null default 'checkout_pending' check (status in (
    'checkout_pending','paid','cj_create_started','sandbox_created','reconciliation_required','cancelled'
  )),
  recipient_ciphertext text,
  cj_order_id text,
  cj_shipment_order_id text,
  cj_status text,
  tracking_number text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cj_supplier_orders_buyer_created_idx on public.cj_supplier_orders (buyer_id, created_at desc);
create index if not exists cj_supplier_orders_reconcile_idx on public.cj_supplier_orders (status, updated_at) where status = 'reconciliation_required';
alter table public.cj_supplier_orders enable row level security;
revoke all on public.cj_supplier_orders from anon, authenticated;
grant all on public.cj_supplier_orders to service_role;
comment on column public.cj_supplier_orders.recipient_ciphertext is 'AES-256-GCM encrypted Stripe shipping details. Never select into user-facing payloads or logs.';
