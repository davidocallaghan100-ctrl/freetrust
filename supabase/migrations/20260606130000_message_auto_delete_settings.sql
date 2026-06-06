alter table profiles
  add column if not exists message_auto_delete_days integer default null;

-- null = never; e.g. 30/90/365 = hide messages older than N days from this user's view

create table if not exists message_user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  hidden_before timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table message_user_state enable row level security;

drop policy if exists "own message state - select" on message_user_state;
create policy "own message state - select" on message_user_state
  for select using (auth.uid() = user_id);

drop policy if exists "own message state - insert" on message_user_state;
create policy "own message state - insert" on message_user_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "own message state - update" on message_user_state;
create policy "own message state - update" on message_user_state
  for update using (auth.uid() = user_id);
