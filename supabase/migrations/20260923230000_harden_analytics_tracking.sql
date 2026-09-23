-- Harden the analytics RPC without removing legitimate anonymous view tracking.
-- Browser clients must never be able to write arbitrary events for arbitrary
-- members or use the RPC to create unbounded fake engagement.

create or replace function public.track_event(
  p_user_id uuid,
  p_event_type text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_owner_id uuid;
  v_event_id uuid;
begin
  if p_user_id is null then
    raise exception 'Analytics owner is required';
  end if;

  if p_metadata is not null and pg_column_size(p_metadata) > 8192 then
    raise exception 'Analytics metadata is too large';
  end if;

  if p_event_type not in (
    'profile_view', 'service_view', 'product_view', 'post_view',
    'post_like', 'post_comment', 'post_share',
    'service_enquiry', 'product_enquiry', 'profile_search_appearance'
  ) then
    raise exception 'This analytics event must be recorded server-side';
  end if;

  if p_event_type in ('profile_view', 'profile_search_appearance') then
    if p_entity_type <> 'profile' or p_entity_id is distinct from p_user_id then
      raise exception 'Invalid profile analytics target';
    end if;
    v_owner_id := p_entity_id;
  elsif p_event_type in ('service_view', 'service_enquiry') then
    if p_entity_type <> 'service' or p_entity_id is null then
      raise exception 'Invalid service analytics target';
    end if;
    select seller_id into v_owner_id from public.listings where id = p_entity_id and product_type = 'service';
  elsif p_event_type in ('product_view', 'product_enquiry') then
    if p_entity_type <> 'product' or p_entity_id is null then
      raise exception 'Invalid product analytics target';
    end if;
    select seller_id into v_owner_id from public.listings where id = p_entity_id and product_type <> 'service';
  elsif p_event_type in ('post_view', 'post_like', 'post_comment', 'post_share') then
    if p_entity_type <> 'post' or p_entity_id is null then
      raise exception 'Invalid post analytics target';
    end if;
    select user_id into v_owner_id from public.feed_posts where id = p_entity_id;
  end if;

  if v_owner_id is distinct from p_user_id then
    raise exception 'Analytics target does not belong to owner';
  end if;

  if v_actor_id is null and p_event_type not in ('profile_view', 'service_view', 'product_view', 'post_view') then
    raise exception 'Anonymous analytics is limited to views';
  end if;

  insert into public.analytics_events (
    user_id, actor_id, event_type, entity_type, entity_id, metadata
  ) values (
    p_user_id, v_actor_id, p_event_type, p_entity_type, p_entity_id, p_metadata
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.track_event(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.track_event(uuid, text, text, uuid, jsonb) to anon;
grant execute on function public.track_event(uuid, text, text, uuid, jsonb) to authenticated;
