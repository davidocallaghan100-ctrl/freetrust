-- Rent & Share booking lifecycle: approve/decline/check-in with escrow-style payout via existing orders table

alter table rent_share_requests
  add column if not exists owner_responded_at timestamptz,
  add column if not exists checked_in_at timestamptz,
  add column if not exists amount numeric(10,2),
  add column if not exists currency text not null default 'EUR',
  add column if not exists order_id uuid references orders(id) on delete set null;

alter table rent_share_requests
  drop constraint if exists rent_share_requests_status_check;

alter table rent_share_requests
  add constraint rent_share_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'cancelled', 'completed'));

comment on column rent_share_requests.order_id is 'Links to orders table for escrow-style payout; owner=seller, requester=buyer';
comment on column rent_share_requests.checked_in_at is 'Set when buyer confirms check-in, triggering payout from escrow to owner wallet';

create index if not exists rent_share_requests_listing_id_idx on rent_share_requests(listing_id);
create index if not exists rent_share_requests_requester_id_idx on rent_share_requests(requester_id);
create index if not exists rent_share_requests_status_idx on rent_share_requests(status);

-- The API performs a friendly overlap check, but only the database can close
-- the race between two owners approving overlapping requests at the same time.
create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.rent_share_requests'::regclass
       and conname = 'rent_share_requests_confirmed_no_overlap'
  ) then
    alter table public.rent_share_requests
      add constraint rent_share_requests_confirmed_no_overlap
      exclude using gist (
        listing_id with =,
        daterange(from_date, to_date, '[)') with &&
      ) where (status in ('approved', 'completed'));
  end if;
end;
$$;

-- Release a Rent & Share booking only once, inside one database transaction.
-- The completed order is the existing wallet ledger entry: the buyer's
-- completed purchase is deducted and the seller's completed sale is credited
-- by /api/wallet. Do not also insert a wallet_transfers row or the wallet
-- balance would be double-counted.
--
-- The advisory lock serializes concurrent EUR spend attempts for the buyer.
-- This keeps two simultaneous check-in requests from both passing the balance
-- check before either completed order is visible to the other transaction.
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

    v_available := v_deposited + v_earned - v_spent - v_sent + v_received;
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

revoke all on function public.rent_share_check_in(uuid, uuid) from public;
grant execute on function public.rent_share_check_in(uuid, uuid) to service_role;

comment on function public.rent_share_check_in(uuid, uuid) is
  'Atomically releases one Rent & Share escrow order at buyer check-in; safe to retry.';
