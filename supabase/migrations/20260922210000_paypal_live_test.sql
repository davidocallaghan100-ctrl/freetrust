-- One-use, admin-only audit records for the explicit PayPal live smoke test.
-- This is deliberately separate from marketplace orders: no seller, listing,
-- TrustCoin discount, or payout is involved.

create table if not exists public.paypal_live_test_runs (
  id uuid primary key default gen_random_uuid(),
  test_group text not null default 'paypal_live_eur_1',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_email text not null,
  paypal_order_id text unique,
  approval_url text,
  paypal_capture_id text,
  amount_cents integer not null default 100 check (amount_cents = 100),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'failed', 'captured')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  captured_at timestamptz
);

alter table public.paypal_live_test_runs enable row level security;

create index if not exists paypal_live_test_runs_created_at_idx
  on public.paypal_live_test_runs(created_at desc);

create unique index if not exists paypal_live_test_runs_one_active_idx
  on public.paypal_live_test_runs(test_group)
  where status in ('pending', 'captured');

-- The route uses the service-role client only after requireFreeTrustAdmin().
-- No browser/client policy is intentionally provided.

create or replace function public.paypal_live_test_runs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists paypal_live_test_runs_updated_at on public.paypal_live_test_runs;
create trigger paypal_live_test_runs_updated_at
before update on public.paypal_live_test_runs
for each row execute function public.paypal_live_test_runs_set_updated_at();

notify pgrst, 'reload schema';
