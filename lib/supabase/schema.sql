-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  bio text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categories
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  parent_id uuid references categories(id) on delete set null
);

-- Listings
create table listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid references profiles(id) on delete cascade not null,
  category_id uuid references categories(id) on delete set null,
  title text not null,
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft', 'active', 'sold', 'archived')),
  images text[] not null default '{}',
  tags text[] not null default '{}',
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conversations
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  seller_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(listing_id, buyer_id)
);

-- Messages
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'read')),
  created_at timestamptz not null default now()
);

-- Reviews
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  reviewer_id uuid references profiles(id) on delete cascade not null,
  reviewee_id uuid references profiles(id) on delete cascade not null,
  listing_id uuid references listings(id) on delete cascade not null,
  target_type text not null check (target_type in ('seller', 'buyer')),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(reviewer_id, listing_id, target_type)
);

-- RLS Policies
alter table profiles enable row level security;
alter table listings enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;

-- Profiles: public read, self write
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Listings: public read active, sellers manage own
create policy "Active listings are viewable by everyone" on listings for select using (status = 'active' or seller_id = auth.uid());
create policy "Sellers can insert listings" on listings for insert with check (auth.uid() = seller_id);
create policy "Sellers can update own listings" on listings for update using (auth.uid() = seller_id);
create policy "Sellers can delete own listings" on listings for delete using (auth.uid() = seller_id);

-- Conversations: participants only
create policy "Participants can view conversations" on conversations for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Buyers can create conversations" on conversations for insert with check (auth.uid() = buyer_id);

-- Messages: conversation participants only
create policy "Participants can view messages" on messages for select using (
  exists (select 1 from conversations c where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid()))
);
create policy "Participants can send messages" on messages for insert with check (
  auth.uid() = sender_id and
  exists (select 1 from conversations c where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid()))
);

-- Reviews: public read, reviewer write
create policy "Reviews are viewable by everyone" on reviews for select using (true);
create policy "Users can write reviews" on reviews for insert with check (auth.uid() = reviewer_id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Trust Economy
-- ============================================================

-- Trust balance per member
create table trust_balances (
  user_id    uuid primary key references profiles(id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  lifetime   integer not null default 0,
  updated_at timestamptz default now()
);

-- Full audit ledger (double-entry)
create table trust_ledger (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete cascade,
  amount       integer not null,
  type         text not null,
  reference_id uuid,
  description  text,
  created_at   timestamptz default now()
);

-- RLS
alter table trust_balances enable row level security;
alter table trust_ledger enable row level security;

create policy "Users view own balance" on trust_balances
  for select using (auth.uid() = user_id);

create policy "Users view own ledger" on trust_ledger
  for select using (auth.uid() = user_id);

-- Function to issue Trust atomically
create or replace function issue_trust(
  p_user_id uuid,
  p_amount  integer,
  p_type    text,
  p_ref     uuid,
  p_desc    text
) returns void as $$
begin
  insert into trust_ledger (user_id, amount, type, reference_id, description)
  values (p_user_id, p_amount, p_type, p_ref, p_desc);

  insert into trust_balances (user_id, balance, lifetime)
  values (p_user_id, p_amount, p_amount)
  on conflict (user_id) do update set
    balance  = trust_balances.balance + p_amount,
    lifetime = trust_balances.lifetime + greatest(p_amount, 0),
    updated_at = now();
end;
$$ language plpgsql security definer;
