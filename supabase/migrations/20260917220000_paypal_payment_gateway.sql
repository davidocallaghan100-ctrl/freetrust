-- PayPal gateway support for FreeTrust marketplace orders.
-- Additive only: existing Stripe orders remain payment_gateway = 'stripe'.

alter table public.orders
  add column if not exists payment_gateway text not null default 'stripe',
  add column if not exists payment_amount_cents integer,
  add column if not exists paypal_intent text,
  add column if not exists paypal_order_id text,
  add column if not exists paypal_authorization_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists paypal_payout_batch_id text,
  add column if not exists paypal_payout_status text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.orders'::regclass
       and conname = 'orders_payment_gateway_check'
  ) then
    alter table public.orders
      add constraint orders_payment_gateway_check
      check (payment_gateway in ('stripe', 'paypal'));
  end if;
end $$;

alter table public.profiles
  add column if not exists paypal_email text;

alter table public.order_items
  add column if not exists paypal_payout_batch_id text,
  add column if not exists paypal_payout_status text,
  add column if not exists paypal_payout_error text;

create index if not exists orders_paypal_order_idx
  on public.orders(paypal_order_id)
  where paypal_order_id is not null;

create index if not exists orders_payment_gateway_idx
  on public.orders(payment_gateway);

notify pgrst, 'reload schema';
