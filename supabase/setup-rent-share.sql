-- =============================================================================
-- FreeTrust — Rent & Share setup
-- Run this once in the Supabase SQL Editor:
--   https://app.supabase.com/project/tioqakxnqjxyuzgnwhrb/sql
-- =============================================================================

-- 0. Storage bucket -----------------------------------------------------------
-- Creates the public 'rent-share' bucket used for listing photo uploads.
-- insert into storage.buckets is idempotent when wrapped in a DO block.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'rent-share', 'rent-share', true, 10485760,
    array['image/jpeg','image/png','image/gif','image/webp']
  )
  on conflict (id) do nothing;
end $$;

-- Allow authenticated users to upload to their own folder
drop policy if exists "Authenticated users can upload rent-share photos" on storage.objects;
create policy "Authenticated users can upload rent-share photos"
  on storage.objects for insert
  with check (
    bucket_id = 'rent-share'
    and auth.role() = 'authenticated'
  );

-- Public read access
drop policy if exists "Public read rent-share photos" on storage.objects;
create policy "Public read rent-share photos"
  on storage.objects for select
  using ( bucket_id = 'rent-share' );

-- Owners can delete their own photos
drop policy if exists "Owners can delete rent-share photos" on storage.objects;
create policy "Owners can delete rent-share photos"
  on storage.objects for delete
  using (
    bucket_id = 'rent-share'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 1. Tables ------------------------------------------------------------------

create table if not exists rent_share_listings (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  title           text        not null check (char_length(title) >= 3),
  description     text        not null check (char_length(description) >= 10),
  category        text        not null default 'Other',
  price_per_day   numeric(10,2),
  price_per_week  numeric(10,2),
  deposit         numeric(10,2) default 0,
  location        text,
  images          text[]      default '{}',
  available_from  date,
  available_to    date,
  status          text        not null default 'active'
                              check (status in ('active','rented','inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists rent_share_requests (
  id            uuid        primary key default gen_random_uuid(),
  listing_id    uuid        not null references rent_share_listings(id) on delete cascade,
  requester_id  uuid        not null references profiles(id) on delete cascade,
  from_date     date        not null,
  to_date       date        not null,
  message       text,
  status        text        not null default 'pending'
                            check (status in ('pending','approved','declined','cancelled')),
  created_at    timestamptz not null default now()
);

-- 2. Row Level Security -------------------------------------------------------

alter table rent_share_listings  enable row level security;
alter table rent_share_requests  enable row level security;

-- Drop existing policies so this script is idempotent
drop policy if exists "Public read rent_share_listings"      on rent_share_listings;
drop policy if exists "Authenticated insert rent_share_listings" on rent_share_listings;
drop policy if exists "Owner update rent_share_listings"     on rent_share_listings;
drop policy if exists "Owner delete rent_share_listings"     on rent_share_listings;
drop policy if exists "Authenticated insert rent_share_requests" on rent_share_requests;
drop policy if exists "View own rent_share_requests"         on rent_share_requests;

-- Anyone can see active listings; owners see all of their own
create policy "Public read rent_share_listings"
  on rent_share_listings for select
  using ( status = 'active' or auth.uid() = user_id );

create policy "Authenticated insert rent_share_listings"
  on rent_share_listings for insert
  with check ( auth.uid() = user_id );

create policy "Owner update rent_share_listings"
  on rent_share_listings for update
  using ( auth.uid() = user_id );

create policy "Owner delete rent_share_listings"
  on rent_share_listings for delete
  using ( auth.uid() = user_id );

create policy "Authenticated insert rent_share_requests"
  on rent_share_requests for insert
  with check ( auth.uid() = requester_id );

create policy "View own rent_share_requests"
  on rent_share_requests for select
  using (
    auth.uid() = requester_id
    or auth.uid() in (
      select user_id from rent_share_listings where id = listing_id
    )
  );

-- 3. Seed data ----------------------------------------------------------------
-- Uses the first admin profile as the listing owner (falls back to any profile)

do $$
declare v_user_id uuid;
begin
  select id into v_user_id from profiles where role = 'admin' limit 1;
  if v_user_id is null then
    select id into v_user_id from profiles limit 1;
  end if;
  if v_user_id is null then
    raise exception 'No profiles found — create a user account first then re-run.';
  end if;

  insert into rent_share_listings
    (user_id, title, description, category, price_per_day, price_per_week,
     deposit, location, images, available_from, available_to, status)
  values
  (v_user_id, 'Bosch GSB 18V-55 Impact Drill',
   'High-performance cordless impact drill in excellent condition. Two 18V batteries, charger, and full bit set in a carry case. Perfect for DIY, flat-pack assembly, and masonry work.',
   'Tools', 8, 35, 50, 'Dublin 8',
   array['https://picsum.photos/seed/drill123/600/400'],
   '2026-04-10', '2026-12-31', 'active'),

  (v_user_id, 'Sony A7III Mirrorless Camera',
   'Full-frame Sony A7III with 28-70mm kit lens. Mint condition — rarely used. Comes with extra battery, 64GB SD card, and padded carry bag. Perfect for weekend shoots or events.',
   'Electronics', 35, 160, 300, 'Cork City',
   array['https://picsum.photos/seed/camera456/600/400'],
   '2026-04-15', '2026-11-30', 'active'),

  (v_user_id, 'Electric Cargo Bike (Urban Arrow)',
   'Urban Arrow family cargo e-bike with front cargo box. Fits two kids or large loads. Pedal-assist up to 25km/h. Includes rain cover, child seat insert, and lock.',
   'Vehicles', 25, 110, 100, 'Galway City',
   array['https://picsum.photos/seed/cargobike/600/400'],
   '2026-04-11', '2026-10-31', 'active'),

  (v_user_id, 'Three-Man Camping Tent (Vango Blade 300)',
   'Lightweight three-season tent, 1.9kg. Quick pitch design. Used twice. Comes with ground sheet, pegs, and carry bag. Great for festivals, hillwalking, or camping around Ireland.',
   'Equipment', 12, 50, 40, 'Wicklow Town',
   array['https://picsum.photos/seed/tent789/600/400'],
   '2026-04-20', '2026-09-30', 'active'),

  (v_user_id, 'Karcher K5 Pressure Washer',
   'Powerful 145-bar pressure washer with 10m hose. Excellent for driveways, patios, garden furniture, and cars. Includes patio cleaning attachment and vario lance.',
   'Tools', 18, 70, 60, 'Dublin 12',
   array['https://picsum.photos/seed/pressure/600/400'],
   '2026-04-12', null, 'active'),

  (v_user_id, 'Formal Suit — Dark Navy, Size 40R',
   'Dark navy two-piece formal suit, size 40 regular. Worn once at a wedding. Dry cleaned and in perfect condition. Great for interviews, functions, and graduations. Includes matching tie.',
   'Clothing', 25, 80, 50, 'Limerick City',
   array['https://picsum.photos/seed/formalsuit/600/400'],
   '2026-04-10', '2026-12-31', 'active'),

  (v_user_id, 'Kayak with Paddle & Life Jacket',
   'Sit-on-top recreational kayak, 9ft. Suitable for flat water, rivers, and sheltered coastal water. Two-part paddle, adult life jacket, and dry bag included.',
   'Equipment', 30, 120, 80, 'Galway Bay area',
   array['https://picsum.photos/seed/kayak999/600/400'],
   '2026-05-01', '2026-09-15', 'active'),

  (v_user_id, 'JBL Eon One Pro PA Speaker',
   'Professional 1000W all-in-one PA speaker with built-in 4-channel mixer, Bluetooth, and 10-hour battery. Ideal for outdoor events, house parties, and small gigs.',
   'Electronics', 40, 170, 150, 'Cork City',
   array['https://picsum.photos/seed/speaker111/600/400'],
   '2026-04-10', null, 'active'),

  (v_user_id, 'Dry Storage Unit (10m²) — Dublin',
   'Clean, dry, ground-floor storage unit for furniture, boxes, bikes, or small business stock. Secure building with 24/7 access. Near the M50. Minimum 2-day booking.',
   'Space', 8, 40, 0, 'Dublin 22',
   array['https://picsum.photos/seed/storage222/600/400'],
   '2026-04-13', null, 'active'),

  (v_user_id, 'Brother Sewing Machine (FS40S)',
   'Beginner-friendly sewing machine with 40 built-in stitch patterns, automatic needle threader, and LED light. Great for clothing repairs, alterations, curtains, and craft projects.',
   'Electronics', 10, 40, 30, 'Cork Suburbs',
   array['https://picsum.photos/seed/sewing333/600/400'],
   '2026-04-10', '2026-12-31', 'active'),

  (v_user_id, 'Makita Circular Saw 18V (DHS660Z)',
   'Cordless 18V circular saw with 165mm blade. Ideal for timber cutting, sheet material, and renovation work. Includes blade, dust extraction adapter, and guide rail.',
   'Tools', 15, 60, 80, 'Dublin 15',
   array['https://picsum.photos/seed/circsaw/600/400'],
   '2026-04-14', null, 'active'),

  (v_user_id, 'Roof Tent — Free Community Borrow',
   'Folding roof tent for 4x4s and SUVs. Quick mount system, two-person capacity with foam mattress. Available to FreeTrust community members — cover return transport costs only.',
   'Equipment', 0, 0, 50, 'Galway',
   array['https://picsum.photos/seed/rooftent/600/400'],
   '2026-05-01', '2026-08-31', 'active')
  ;

  raise notice 'Seeded 12 listings for user_id: %', v_user_id;
end $$;
