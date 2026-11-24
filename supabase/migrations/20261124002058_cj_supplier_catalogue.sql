-- Private, empty CJ supplier catalogue. Applied to FreeTrust production on 2026-11-24.
create table if not exists public.cj_supplier_catalogue (
  id uuid primary key default gen_random_uuid(),
  cj_product_id text not null,
  cj_variant_id text not null unique,
  cj_variant_sku text,
  title text not null,
  variant_label text,
  image_url text,
  category text,
  supplier_unit_cost_usd_cents integer check (supplier_unit_cost_usd_cents is null or supplier_unit_cost_usd_cents >= 0),
  shipping_cost_usd_cents integer check (shipping_cost_usd_cents is null or shipping_cost_usd_cents >= 0),
  landed_cost_eur_cents integer check (landed_cost_eur_cents is null or landed_cost_eur_cents > 0),
  retail_price_eur_cents integer check (retail_price_eur_cents is null or retail_price_eur_cents > 0),
  verified_stock integer not null default 0 check (verified_stock >= 0),
  source_country_code text,
  destination_country_code text not null default 'IE',
  logistics_name text,
  inventory_checked_at timestamptz,
  shipping_checked_at timestamptz,
  tax_policy_approved boolean not null default false,
  compliance_approved boolean not null default false,
  returns_policy_approved boolean not null default false,
  pricing_approved boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  is_public boolean not null default false,
  supplier_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cj_supplier_catalogue_public_guard check (
    not is_public or (
      status = 'active' and verified_stock > 0 and inventory_checked_at is not null and shipping_checked_at is not null
      and supplier_unit_cost_usd_cents is not null and shipping_cost_usd_cents is not null
      and landed_cost_eur_cents is not null and retail_price_eur_cents is not null
      and tax_policy_approved and compliance_approved and returns_policy_approved and pricing_approved
    )
  ),
  constraint cj_supplier_catalogue_country_code_check check (
    destination_country_code ~ '^[A-Z]{2}$' and (source_country_code is null or source_country_code ~ '^[A-Z]{2}$')
  )
);

create index if not exists cj_supplier_catalogue_public_lookup_idx
  on public.cj_supplier_catalogue (status, destination_country_code, inventory_checked_at desc) where is_public = true;
create index if not exists cj_supplier_catalogue_product_idx on public.cj_supplier_catalogue (cj_product_id);
alter table public.cj_supplier_catalogue enable row level security;
revoke all on public.cj_supplier_catalogue from anon, authenticated;
grant all on public.cj_supplier_catalogue to service_role;
comment on table public.cj_supplier_catalogue is 'Private, empty CJ supplier catalogue; publication requires explicit pricing, tax, compliance, returns, stock and shipping approval.';
