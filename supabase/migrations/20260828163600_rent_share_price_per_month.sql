-- Rent & Share: add monthly price/budget support so owners can display a monthly rate
-- (e.g. for property/room listings), alongside the existing per-day/per-week pricing.

alter table rent_share_listings add column if not exists price_per_month numeric(10,2);
