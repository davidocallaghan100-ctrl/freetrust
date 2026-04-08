-- notifications table
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'message' | 'order' | 'trust' | 'review' | 'gig_liked' | 'system'
  title text not null,
  body text not null,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx on notifications(user_id, read);
alter table notifications enable row level security;

drop policy if exists "Users see own notifications" on notifications;
drop policy if exists "Users update own notifications" on notifications;
drop policy if exists "Service role insert" on notifications;

create policy "Users see own notifications" on notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on notifications for update using (auth.uid() = user_id);
create policy "Service role insert" on notifications for insert with check (true);

-- notification_preferences table
create table if not exists notification_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  messages boolean default true,
  orders boolean default true,
  trust boolean default true,
  reviews boolean default true,
  gig_liked boolean default true,
  system boolean default true,
  email_digest boolean default false,
  updated_at timestamptz default now()
);
alter table notification_preferences enable row level security;

drop policy if exists "Users manage own prefs" on notification_preferences;
create policy "Users manage own prefs" on notification_preferences for all using (auth.uid() = user_id);
