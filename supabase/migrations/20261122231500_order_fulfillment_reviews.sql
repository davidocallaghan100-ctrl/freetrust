-- Add item-level fulfillment fields for immediately-paid product baskets and
-- order-bound references for post-completion marketplace reviews.
-- Preserve the production delivery_status column as the canonical state; this
-- migration does not change basket payment or seller-payout settlement.

-- The current service-order routes read/write these fields for delivery,
-- escrow release, and dispute state, but they are absent from production.
alter table public.orders
  add column if not exists delivery_notes text,
  add column if not exists escrow_released_at timestamptz,
  add column if not exists dispute_reason text;

alter table public.order_items
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists delivery_notes text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Production already constrains delivery_status to the lifecycle values used
-- by checkout. Extend that same field rather than creating a competing status.
alter table public.order_items
  drop constraint if exists order_items_delivery_status_check;
alter table public.order_items
  add constraint order_items_delivery_status_check
  check (delivery_status in (
    'pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'disputed'
  ));

-- Null is retained for historical review rows and historical basket items;
-- no past fulfillment state is inferred by this migration.
alter table public.reviews
  add column if not exists order_id uuid,
  add column if not exists order_item_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and conname = 'reviews_order_id_fkey'
  ) then
    alter table public.reviews
      add constraint reviews_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and conname = 'reviews_order_item_id_fkey'
  ) then
    alter table public.reviews
      add constraint reviews_order_item_id_fkey
      foreign key (order_item_id) references public.order_items(id) on delete set null;
  end if;
end $$;

-- One review per completed escrow order, or one per completed basket item.
create unique index if not exists reviews_reviewer_order_unique
  on public.reviews(reviewer_id, order_id)
  where order_id is not null and order_item_id is null;

-- Production already has the equivalent unique basket-item index
-- reviews_one_per_basket_item_and_buyer; avoid creating a duplicate index.

-- Enforce purchase completion at the database boundary too, so clients cannot
-- bypass the authenticated review API with a direct Supabase insert.
create or replace function public.validate_completed_order_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Preserve historical reviews when their source order/item is removed,
  -- but do not allow a caller to manually detach a live review from proof.
  if tg_op = 'UPDATE'
     and new.order_id is null
     and new.order_item_id is null
     and (old.order_id is not null or old.order_item_id is not null) then
    if old.order_id is not null then
      perform 1 from public.orders where id = old.order_id;
    else
      perform 1 from public.order_items where id = old.order_item_id;
    end if;
    if not found then return new; end if;
    raise exception 'A completed-order review cannot be detached from its order reference';
  end if;

  if (new.order_id is null) = (new.order_item_id is null) then
    raise exception 'A review must reference exactly one completed order or basket item';
  end if;

  if new.order_id is not null then
    perform 1
      from public.orders o
      where o.id = new.order_id
        and o.status = 'completed'
        and coalesce(o.type, '') <> 'product_basket'
        and o.buyer_id = new.reviewer_id
        and o.seller_id = new.reviewee_id
        and o.listing_id = new.listing_id
        and new.target_type = 'seller';
    if not found then
      raise exception 'Reviews require a completed order bought by the reviewer for this seller and listing';
    end if;
  else
    perform 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.id = new.order_item_id
        and oi.buyer_id = new.reviewer_id
        and oi.seller_id = new.reviewee_id
        and oi.listing_id = new.listing_id
        and oi.delivery_status = 'completed'
        and oi.completed_at is not null
        and o.type = 'product_basket'
        and o.status in ('paid', 'completed')
        and new.target_type = 'seller';
    if not found then
      raise exception 'Reviews require a completed basket item bought by the reviewer for this seller and listing';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_require_completed_order on public.reviews;
create trigger reviews_require_completed_order
  before insert or update of reviewer_id, reviewee_id, listing_id, target_type, order_id, order_item_id
  on public.reviews
  for each row execute function public.validate_completed_order_review();

notify pgrst, 'reload schema';
