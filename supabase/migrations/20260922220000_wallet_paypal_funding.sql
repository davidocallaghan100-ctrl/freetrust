-- PayPal wallet funding and scoped EUR cash-out support.
--
-- Marketplace earnings intentionally remain outside this cash-out balance.
-- They continue to use the existing Stripe Connect / marketplace PayPal
-- payout flows. This migration only makes completed wallet deposits and EUR
-- member transfers eligible for a separately tracked PayPal withdrawal.

alter table public.money_deposits
  add column if not exists provider text not null default 'stripe',
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists paypal_approval_url text,
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.money_deposits'::regclass
      and conname = 'money_deposits_provider_check'
  ) then
    alter table public.money_deposits
      add constraint money_deposits_provider_check
      check (provider in ('stripe', 'paypal')) not valid;
  end if;
end $$;

create unique index if not exists money_deposits_paypal_order_idx
  on public.money_deposits(paypal_order_id)
  where paypal_order_id is not null;

create unique index if not exists money_deposits_user_idempotency_idx
  on public.money_deposits(user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.wallet_withdrawals (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  amount_cents             integer not null check (amount_cents > 0),
  currency                 text not null default 'eur' check (currency = 'eur'),
  provider                 text not null default 'paypal' check (provider in ('paypal')),
  status                   text not null default 'pending'
                             check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  paypal_email             text not null,
  paypal_payout_batch_id   text,
  paypal_payout_status     text,
  idempotency_key          text,
  error_message            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  completed_at             timestamptz
);

create index if not exists wallet_withdrawals_user_idx
  on public.wallet_withdrawals(user_id, created_at desc);

create unique index if not exists wallet_withdrawals_user_idempotency_idx
  on public.wallet_withdrawals(user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists wallet_withdrawals_paypal_batch_idx
  on public.wallet_withdrawals(paypal_payout_batch_id)
  where paypal_payout_batch_id is not null;

alter table public.wallet_withdrawals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wallet_withdrawals'
      and policyname = 'Users can view own wallet withdrawals'
  ) then
    create policy "Users can view own wallet withdrawals"
      on public.wallet_withdrawals for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wallet_withdrawals'
      and policyname = 'Service role manages wallet withdrawals'
  ) then
    create policy "Service role manages wallet withdrawals"
      on public.wallet_withdrawals for all
      using (auth.role() = 'service_role');
  end if;
end $$;

-- Only deposits and internal EUR transfers are withdrawable through this
-- feature. Completed marketplace order earnings are deliberately excluded:
-- those may already have been paid to Stripe Connect or PayPal sellers.
create or replace function public.wallet_withdrawable_cents(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0::bigint,
    coalesce((
      select sum(md.amount_cents)::bigint
      from public.money_deposits md
      where md.user_id = p_user_id
        and lower(md.currency) = 'eur'
        and md.status = 'completed'
    ), 0::bigint)
    + coalesce((
      select round(coalesce(sum(wt.amount), 0) * 100)::bigint
      from public.wallet_transfers wt
      where wt.recipient_id = p_user_id
        and wt.currency = 'EUR'
        and wt.status = 'completed'
    ), 0::bigint)
    - coalesce((
      select round(coalesce(sum(wt.amount), 0) * 100)::bigint
      from public.wallet_transfers wt
      where wt.sender_id = p_user_id
        and wt.currency = 'EUR'
        and wt.status = 'completed'
    ), 0::bigint)
    - coalesce((
      select round(coalesce(sum(o.amount), 0) * 100)::bigint
      from public.orders o
      where o.buyer_id = p_user_id
        and o.status = 'completed'
        and o.delivery_type <> 'deposit'
    ), 0::bigint)
    - coalesce((
      select sum(ww.amount_cents)::bigint
      from public.wallet_withdrawals ww
      where ww.user_id = p_user_id
        and ww.status in ('pending', 'processing', 'completed')
    ), 0::bigint)
  );
$$;

-- Reserve a withdrawal before contacting PayPal. The profile row is locked so
-- concurrent PayPal withdrawals and EUR transfers using the companion RPC
-- cannot both spend the same tracked wallet funds.
create or replace function public.reserve_wallet_withdrawal(
  p_user_id uuid,
  p_amount_cents integer,
  p_paypal_email text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_withdrawable bigint;
  v_id uuid;
begin
  if p_amount_cents is null or p_amount_cents < 100 then
    raise exception 'invalid_amount: minimum withdrawal is €1.00' using errcode = 'P0001';
  end if;
  if p_paypal_email is null or length(trim(p_paypal_email)) = 0 then
    raise exception 'paypal_email_required' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key_required' using errcode = 'P0001';
  end if;

  -- Serialize all tracked wallet cash-out/transfer mutations for this user.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  select id into v_existing_id
  from public.wallet_withdrawals
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    return v_existing_id;
  end if;

  v_withdrawable := public.wallet_withdrawable_cents(p_user_id);
  if v_withdrawable < p_amount_cents then
    raise exception 'insufficient_withdrawable_balance: available %, requested %', v_withdrawable, p_amount_cents
      using errcode = 'P0001';
  end if;

  insert into public.wallet_withdrawals (
    user_id, amount_cents, provider, status, paypal_email, idempotency_key
  ) values (
    p_user_id, p_amount_cents, 'paypal', 'pending', lower(trim(p_paypal_email)), trim(p_idempotency_key)
  ) returning id into v_id;

  return v_id;
end;
$$;

-- EUR member transfers use the same profile-row lock as withdrawals. Trust
-- transfers retain their existing TrustCoin RPC path.
create or replace function public.create_eur_wallet_transfer(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount_cents integer,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available bigint;
  v_id uuid;
begin
  if p_sender_id is null or p_recipient_id is null or p_sender_id = p_recipient_id then
    raise exception 'invalid_transfer_recipient' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 then
    raise exception 'invalid_transfer_amount' using errcode = 'P0001';
  end if;

  -- Deterministic ordering avoids deadlocks when two members transfer to one
  -- another at the same time.
  perform 1
  from public.profiles
  where id in (p_sender_id, p_recipient_id)
  order by id
  for update;

  if (select count(*) from public.profiles where id in (p_sender_id, p_recipient_id)) <> 2 then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  v_available := public.wallet_withdrawable_cents(p_sender_id);
  if v_available < p_amount_cents then
    raise exception 'insufficient_withdrawable_balance: available %, requested %', v_available, p_amount_cents
      using errcode = 'P0001';
  end if;

  insert into public.wallet_transfers (
    sender_id, recipient_id, amount, currency, note, status
  ) values (
    p_sender_id, p_recipient_id, p_amount_cents::numeric / 100, 'EUR', coalesce(p_note, ''), 'completed'
  ) returning id into v_id;

  return v_id;
end;
$$;

-- This helper accepts an arbitrary user id and is only called server-side;
-- exposing it to authenticated clients would leak another member's balance.
revoke all on function public.wallet_withdrawable_cents(uuid) from public, anon, authenticated;
revoke all on function public.reserve_wallet_withdrawal(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.create_eur_wallet_transfer(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_withdrawable_cents(uuid) to service_role;
grant execute on function public.reserve_wallet_withdrawal(uuid, integer, text, text) to service_role;
grant execute on function public.create_eur_wallet_transfer(uuid, uuid, integer, text) to service_role;

-- Keep Rent & Share check-in from reusing funds reserved by a PayPal
-- withdrawal. The original function predates wallet_withdrawals, so replace
-- it here rather than editing the already-applied historical migration.
create or replace function public.rent_share_check_in(
  p_request_id uuid,
  p_requester_id uuid
)
returns table (
  request_id uuid,
  order_id uuid,
  seller_id uuid,
  amount numeric,
  checked_in_at timestamptz,
  is_replay boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.rent_share_requests%rowtype;
  v_order_status text;
  v_deposited numeric := 0;
  v_earned numeric := 0;
  v_spent numeric := 0;
  v_sent numeric := 0;
  v_received numeric := 0;
  v_withdrawn numeric := 0;
  v_available numeric := 0;
  v_checked_in_at timestamptz;
  v_is_replay boolean;
begin
  if p_requester_id is null then
    raise exception 'Requester is required' using errcode = '22023';
  end if;

  -- Coordinate with other Rent & Share check-ins by this buyer.
  perform pg_advisory_xact_lock(hashtextextended(p_requester_id::text, 0));

  select *
    into v_request
    from public.rent_share_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'Booking request not found' using errcode = 'P0002';
  end if;

  if v_request.requester_id <> p_requester_id then
    raise exception 'Only the requester can confirm check-in' using errcode = '42501';
  end if;

  v_is_replay := v_request.status = 'completed';

  if v_request.status not in ('approved', 'completed') then
    raise exception 'Booking is not approved' using errcode = 'P0001';
  end if;

  if v_request.order_id is null or v_request.amount is null or v_request.amount <= 0 then
    raise exception 'Booking is missing payment details' using errcode = 'P0001';
  end if;

  select o.status
    into v_order_status
    from public.orders o
   where o.id = v_request.order_id
   for update;

  if not found then
    raise exception 'Booking payment order not found' using errcode = 'P0001';
  end if;

  if v_order_status not in ('pending_escrow', 'completed') then
    raise exception 'Booking payment is not releasable' using errcode = 'P0001';
  end if;

  if v_is_replay and v_order_status <> 'completed' then
    raise exception 'Booking and payment state do not match' using errcode = 'P0001';
  end if;

  -- A completed request/order is a safe idempotent replay. If an earlier
  -- attempt completed the order but failed before updating the request, repair
  -- the request here and let the caller send the missing notifications.
  if not v_is_replay and v_order_status = 'pending_escrow' then
    if current_date < v_request.from_date then
      raise exception 'Check-in opens on %', v_request.from_date using errcode = 'P0001';
    end if;
    if current_date >= v_request.to_date then
      raise exception 'The check-in window for this booking has passed' using errcode = 'P0001';
    end if;

    select coalesce(sum(md.amount_cents)::numeric / 100, 0)
      into v_deposited
      from public.money_deposits md
     where md.user_id = p_requester_id
       and lower(md.currency) = 'eur'
       and md.status = 'completed';

    select coalesce(sum(o.amount), 0)
      into v_earned
      from public.orders o
     where o.seller_id = p_requester_id
       and o.status = 'completed'
       and o.delivery_type <> 'deposit';

    select coalesce(sum(o.amount), 0)
      into v_spent
      from public.orders o
     where o.buyer_id = p_requester_id
       and o.status = 'completed'
       and o.delivery_type <> 'deposit';

    select coalesce(sum(wt.amount), 0)
      into v_sent
      from public.wallet_transfers wt
     where wt.sender_id = p_requester_id
       and wt.currency = 'EUR'
       and wt.status = 'completed';

    select coalesce(sum(wt.amount), 0)
      into v_received
      from public.wallet_transfers wt
     where wt.recipient_id = p_requester_id
       and wt.currency = 'EUR'
       and wt.status = 'completed';

    select coalesce(sum(ww.amount_cents)::numeric / 100, 0)
      into v_withdrawn
      from public.wallet_withdrawals ww
     where ww.user_id = p_requester_id
       and ww.status in ('pending', 'processing', 'completed');

    v_available := v_deposited + v_earned - v_spent - v_sent + v_received - v_withdrawn;
    if v_available < v_request.amount then
      raise exception 'Insufficient wallet balance' using errcode = 'P0001';
    end if;

    update public.orders
       set status = 'completed', updated_at = now()
     where id = v_request.order_id
       and status = 'pending_escrow';
  end if;

  v_checked_in_at := coalesce(v_request.checked_in_at, now());

  if not v_is_replay then
    update public.rent_share_requests
       set status = 'completed', checked_in_at = v_checked_in_at
     where id = p_request_id
       and status = 'approved';
  end if;

  return query
  select v_request.id,
         v_request.order_id,
         (select o.seller_id from public.orders o where o.id = v_request.order_id),
         v_request.amount,
         v_checked_in_at,
         v_is_replay;
end;
$$;

revoke all on function public.rent_share_check_in(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rent_share_check_in(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
