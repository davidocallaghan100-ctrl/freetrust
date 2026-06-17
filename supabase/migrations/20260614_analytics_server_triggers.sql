-- Server-side analytics events for messages and follows.
-- These triggers keep recipient-owned events out of sender/browser control.

create or replace function public.track_message_received_analytics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_events (
    user_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  select
    cp.user_id,
    new.sender_id,
    'message_received',
    'message',
    new.id,
    jsonb_build_object('conversation_id', new.conversation_id)
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id
    and not exists (
      select 1
      from public.analytics_events ae
      where ae.user_id = cp.user_id
        and ae.event_type = 'message_received'
        and ae.entity_id = new.id
    );

  return new;
end;
$$;

drop trigger if exists messages_track_message_received_analytics on public.messages;

create trigger messages_track_message_received_analytics
after insert on public.messages
for each row
execute function public.track_message_received_analytics();

create or replace function public.track_follower_gained_analytics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.following_id is distinct from new.follower_id then
    insert into public.analytics_events (
      user_id,
      actor_id,
      event_type,
      entity_type,
      entity_id,
      metadata
    )
    select
      new.following_id,
      new.follower_id,
      'follower_gained',
      'follower',
      new.follower_id,
      jsonb_build_object('follower_id', new.follower_id)
    where not exists (
      select 1
      from public.analytics_events ae
      where ae.user_id = new.following_id
        and ae.actor_id = new.follower_id
        and ae.event_type = 'follower_gained'
        and ae.entity_type = 'follower'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists user_follows_track_follower_gained_analytics on public.user_follows;

create trigger user_follows_track_follower_gained_analytics
after insert on public.user_follows
for each row
execute function public.track_follower_gained_analytics();
