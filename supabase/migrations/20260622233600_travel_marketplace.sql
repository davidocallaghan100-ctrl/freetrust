create table if not exists public.travel_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  search_type text not null check (search_type in ('flights', 'accommodation', 'both')),
  destination_country text not null,
  destination_city text,
  departure_city text,
  check_in date,
  check_out date,
  departure_date date,
  return_date date,
  adults int default 1,
  children int default 0,
  rooms int default 1,
  cabin_class text default 'economy',
  created_at timestamptz default now()
);

alter table public.travel_searches enable row level security;

create policy "Users can manage own travel searches"
  on public.travel_searches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.travel_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  search_id uuid references public.travel_searches(id),
  booking_type text not null check (booking_type in ('flight', 'accommodation', 'bundle')),
  external_id text,
  provider text default 'booking.com',
  destination_country text,
  destination_city text,
  property_name text,
  flight_number text,
  airline text,
  price_eur numeric(10,2),
  currency text default 'EUR',
  check_in date,
  check_out date,
  departure_date date,
  return_date date,
  adults int default 1,
  rooms int default 1,
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  affiliate_url text,
  trust_coins_earned int default 0,
  created_at timestamptz default now()
);

alter table public.travel_bookings enable row level security;

create policy "Users can manage own travel bookings"
  on public.travel_bookings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
