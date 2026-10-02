-- Member-owned Composio connection references.
-- The provider connection id is encrypted by the server and is never exposed
-- to browser clients. Supabase RLS still protects the metadata if a future
-- client-side read is added.

create table if not exists public.member_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  toolkit text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'error', 'disconnected', 'revoked')),
  external_account_name text,
  encrypted_connection_state text,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists member_integrations_user_updated_idx
  on public.member_integrations (user_id, updated_at desc);

alter table public.member_integrations enable row level security;

drop policy if exists member_integrations_select_own on public.member_integrations;
create policy member_integrations_select_own
  on public.member_integrations for select
  using (user_id = auth.uid());

drop policy if exists member_integrations_insert_own on public.member_integrations;
create policy member_integrations_insert_own
  on public.member_integrations for insert
  with check (user_id = auth.uid());

drop policy if exists member_integrations_update_own on public.member_integrations;
create policy member_integrations_update_own
  on public.member_integrations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists member_integrations_delete_own on public.member_integrations;
create policy member_integrations_delete_own
  on public.member_integrations for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.member_integrations to authenticated;

create or replace function public.touch_member_integrations_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists member_integrations_updated_at on public.member_integrations;
create trigger member_integrations_updated_at
  before update on public.member_integrations
  for each row execute function public.touch_member_integrations_updated_at();

notify pgrst, 'reload schema';
