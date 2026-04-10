-- Rent & Share community marketplace

create table if not exists rent_share_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) >= 3),
  description text not null check (char_length(description) >= 10),
  category text not null default 'Other',
  price_per_day numeric(10,2),
  price_per_week numeric(10,2),
  deposit numeric(10,2) default 0,
  location text,
  images text[] default '{}',
  available_from date,
  available_to date,
  status text not null default 'active' check (status in ('active', 'rented', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rent_share_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references rent_share_listings(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Row-level security
alter table rent_share_listings enable row level security;
alter table rent_share_requests enable row level security;

-- Anyone can read active listings; owners can read their own regardless of status
create policy "Public read rent_share_listings"
  on rent_share_listings for select
  using (status = 'active' or auth.uid() = user_id);

create policy "Authenticated insert rent_share_listings"
  on rent_share_listings for insert
  with check (auth.uid() = user_id);

create policy "Owner update rent_share_listings"
  on rent_share_listings for update
  using (auth.uid() = user_id);

create policy "Owner delete rent_share_listings"
  on rent_share_listings for delete
  using (auth.uid() = user_id);

-- Rent requests
create policy "Authenticated insert rent_share_requests"
  on rent_share_requests for insert
  with check (auth.uid() = requester_id);

create policy "View own rent_share_requests"
  on rent_share_requests for select
  using (
    auth.uid() = requester_id
    or auth.uid() in (
      select user_id from rent_share_listings where id = listing_id
    )
  );
