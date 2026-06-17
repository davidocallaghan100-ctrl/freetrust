create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text null,
  entity_id uuid null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  constraint analytics_events_event_type_check check (
    event_type in (
      'profile_view',
      'service_view',
      'product_view',
      'post_view',
      'post_like',
      'post_comment',
      'post_share',
      'service_enquiry',
      'product_enquiry',
      'message_received',
      'follower_gained',
      'profile_search_appearance'
    )
  ),
  constraint analytics_events_entity_type_check check (
    entity_type is null or entity_type in (
      'profile',
      'service',
      'product',
      'post',
      'message',
      'follower',
      'search'
    )
  )
);

create index if not exists analytics_events_user_id_idx on public.analytics_events(user_id);
create index if not exists analytics_events_event_type_idx on public.analytics_events(event_type);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at);
create index if not exists analytics_events_user_event_created_idx on public.analytics_events(user_id, event_type, created_at desc);
create index if not exists analytics_events_user_entity_created_idx on public.analytics_events(user_id, entity_type, entity_id, created_at desc);

alter table public.analytics_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'Users can read own analytics events'
  ) then
    create policy "Users can read own analytics events"
      on public.analytics_events
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

revoke all on public.analytics_events from anon;
revoke all on public.analytics_events from authenticated;
grant select on public.analytics_events to authenticated;

create or replace function public.track_event(
  p_user_id uuid,
  p_event_type text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.analytics_events (
    user_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_user_id,
    auth.uid(),
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_metadata
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.track_event(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.track_event(uuid, text, text, uuid, jsonb) to anon;
grant execute on function public.track_event(uuid, text, text, uuid, jsonb) to authenticated;
