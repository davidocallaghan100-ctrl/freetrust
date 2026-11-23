-- FreeTrust Developer Hub Phase 1.
-- Additive only: no existing marketplace, identity, payment, or user data is changed.
-- API keys are hashed at creation and only service_role may access these tables.

create table if not exists public.developer_apps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_apps_owner_created_idx
  on public.developer_apps (owner_id, created_at desc);

create table if not exists public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.developer_apps(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  key_prefix text not null unique check (key_prefix ~ '^ft_live_[A-Za-z0-9_-]{12}$'),
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] not null default array['listings:read']::text[],
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint developer_api_keys_phase1_scopes_check check (
    cardinality(scopes) between 1 and 1
    and scopes <@ array['listings:read']::text[]
  )
);

create index if not exists developer_api_keys_app_created_idx
  on public.developer_api_keys (app_id, created_at desc);

create index if not exists developer_api_keys_active_app_idx
  on public.developer_api_keys (app_id, expires_at)
  where revoked_at is null;

create table if not exists public.developer_api_usage (
  id uuid primary key,
  app_id uuid not null references public.developer_apps(id) on delete cascade,
  api_key_id uuid not null references public.developer_api_keys(id) on delete cascade,
  method text not null check (method in ('GET')),
  path text not null check (char_length(path) between 1 and 200),
  status_code integer not null check (status_code between 100 and 599),
  response_time_ms integer not null check (response_time_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists developer_api_usage_app_created_idx
  on public.developer_api_usage (app_id, created_at desc);

create index if not exists developer_api_usage_key_created_idx
  on public.developer_api_usage (api_key_id, created_at desc);

create table if not exists public.developer_api_rate_state (
  api_key_id uuid primary key references public.developer_api_keys(id) on delete cascade,
  minute_window_start timestamptz not null,
  minute_request_count integer not null default 0 check (minute_request_count >= 0),
  day_window_start date not null,
  day_request_count integer not null default 0 check (day_request_count >= 0),
  updated_at timestamptz not null default now()
);

-- No browser role is granted access to app records, API key hashes, usage, or
-- quota state. All access is performed by authenticated server routes.
alter table public.developer_apps enable row level security;
alter table public.developer_api_keys enable row level security;
alter table public.developer_api_usage enable row level security;
alter table public.developer_api_rate_state enable row level security;

revoke all on public.developer_apps from public, anon, authenticated;
revoke all on public.developer_api_keys from public, anon, authenticated;
revoke all on public.developer_api_usage from public, anon, authenticated;
revoke all on public.developer_api_rate_state from public, anon, authenticated;

grant all on public.developer_apps to service_role;
grant all on public.developer_api_keys to service_role;
grant all on public.developer_api_usage to service_role;
grant all on public.developer_api_rate_state to service_role;

create or replace function public.developer_api_consume_quota(
  p_key_id uuid,
  p_now timestamptz,
  p_requests_per_minute integer,
  p_requests_per_day integer
) returns table (
  is_allowed boolean,
  minute_request_count integer,
  day_request_count integer,
  minute_reset_at timestamptz,
  day_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minute_start timestamptz := date_trunc('minute', p_now);
  v_day_start date := (p_now at time zone 'UTC')::date;
  v_state public.developer_api_rate_state%rowtype;
begin
  if p_key_id is null or p_now is null
    or p_requests_per_minute is null or p_requests_per_minute < 1
    or p_requests_per_day is null or p_requests_per_day < 1 then
    raise exception 'invalid_developer_api_quota_parameters';
  end if;

  -- Serialize requests per key in the database so quota state is consistent
  -- across server instances. A revocation racing this call is honoured before
  -- a later call can use the key.
  perform 1
  from public.developer_api_keys k
  join public.developer_apps a on a.id = k.app_id
  where k.id = p_key_id
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > p_now)
    and a.status = 'active'
  for update of k;

  if not found then
    raise exception 'developer_api_key_inactive';
  end if;

  insert into public.developer_api_rate_state as current_state (
    api_key_id,
    minute_window_start,
    minute_request_count,
    day_window_start,
    day_request_count,
    updated_at
  ) values (
    p_key_id,
    v_minute_start,
    1,
    v_day_start,
    1,
    p_now
  )
  on conflict (api_key_id) do update set
    minute_window_start = case
      when current_state.minute_window_start < v_minute_start then v_minute_start
      else current_state.minute_window_start
    end,
    minute_request_count = case
      when current_state.minute_window_start < v_minute_start then 1
      else least(current_state.minute_request_count + 1, p_requests_per_minute + 1)
    end,
    day_window_start = case
      when current_state.day_window_start < v_day_start then v_day_start
      else current_state.day_window_start
    end,
    day_request_count = case
      when current_state.day_window_start < v_day_start then 1
      else least(current_state.day_request_count + 1, p_requests_per_day + 1)
    end,
    updated_at = p_now
  returning * into v_state;

  return query select
    v_state.minute_request_count <= p_requests_per_minute
      and v_state.day_request_count <= p_requests_per_day,
    v_state.minute_request_count,
    v_state.day_request_count,
    v_state.minute_window_start + interval '1 minute',
    ((v_state.day_window_start + 1)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.developer_api_consume_quota(uuid, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.developer_api_consume_quota(uuid, timestamptz, integer, integer) to service_role;

create or replace function public.developer_api_dashboard(
  p_owner_id uuid,
  p_days integer default 7,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
  v_active_apps integer;
  v_active_keys integer;
  v_total_requests bigint;
  v_successful_requests bigint;
  v_failed_requests bigint;
  v_daily_usage jsonb;
  v_recent_activity jsonb;
begin
  if p_owner_id is null or p_days not in (7, 30, 90) or p_now is null then
    raise exception 'invalid_developer_api_dashboard_parameters';
  end if;

  v_start := (date_trunc('day', p_now at time zone 'UTC') - ((p_days - 1) * interval '1 day')) at time zone 'UTC';

  select count(*)::integer into v_active_apps
  from public.developer_apps a
  where a.owner_id = p_owner_id and a.status = 'active';

  select count(*)::integer into v_active_keys
  from public.developer_api_keys k
  join public.developer_apps a on a.id = k.app_id
  where a.owner_id = p_owner_id
    and a.status = 'active'
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > p_now);

  select
    count(*)::bigint,
    count(*) filter (where u.status_code < 400)::bigint,
    count(*) filter (where u.status_code >= 400)::bigint
  into v_total_requests, v_successful_requests, v_failed_requests
  from public.developer_api_usage u
  join public.developer_apps a on a.id = u.app_id
  where a.owner_id = p_owner_id and u.created_at >= v_start and u.created_at <= p_now;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', to_char(days.day::date, 'YYYY-MM-DD'),
      'requests', (
        select count(*)::integer
        from public.developer_api_usage u
        join public.developer_apps a on a.id = u.app_id
        where a.owner_id = p_owner_id
          and u.created_at >= (days.day::date::timestamp at time zone 'UTC')
          and u.created_at < ((days.day::date + 1)::timestamp at time zone 'UTC')
      )
    ) order by days.day
  ), '[]'::jsonb)
  into v_daily_usage
  from generate_series(
    date_trunc('day', p_now at time zone 'UTC') - ((p_days - 1) * interval '1 day'),
    date_trunc('day', p_now at time zone 'UTC'),
    interval '1 day'
  ) as days(day);

  select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at desc), '[]'::jsonb)
  into v_recent_activity
  from (
    select u.id, u.method, u.path, u.status_code, u.response_time_ms, u.created_at
    from public.developer_api_usage u
    join public.developer_apps a on a.id = u.app_id
    where a.owner_id = p_owner_id
    order by u.created_at desc
    limit 8
  ) as activity;

  return jsonb_build_object(
    'activeApps', coalesce(v_active_apps, 0),
    'activeKeys', coalesce(v_active_keys, 0),
    'totalRequests', coalesce(v_total_requests, 0),
    'successfulRequests', coalesce(v_successful_requests, 0),
    'failedRequests', coalesce(v_failed_requests, 0),
    'days', p_days,
    'dailyUsage', v_daily_usage,
    'recentActivity', v_recent_activity
  );
end;
$$;

revoke all on function public.developer_api_dashboard(uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.developer_api_dashboard(uuid, integer, timestamptz) to service_role;

create or replace function public.developer_api_rotate_key(
  p_owner_id uuid,
  p_key_id uuid,
  p_new_key_id uuid,
  p_name text,
  p_key_prefix text,
  p_secret_hash text,
  p_scopes text[],
  p_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app_id uuid;
begin
  if p_owner_id is null or p_key_id is null or p_new_key_id is null
    or p_name is null or char_length(p_name) not between 2 and 80
    or p_key_prefix is null or p_secret_hash is null
    or p_scopes is null or cardinality(p_scopes) <> 1
    or not (p_scopes <@ array['listings:read']::text[]) then
    raise exception 'invalid_developer_api_rotation_parameters';
  end if;

  select a.id into v_app_id
  from public.developer_api_keys old_key
  join public.developer_apps a on a.id = old_key.app_id
  where old_key.id = p_key_id
    and a.owner_id = p_owner_id
    and a.status = 'active'
    and old_key.revoked_at is null
    and (old_key.expires_at is null or old_key.expires_at > now())
  for update of old_key;

  if not found then
    raise exception 'developer_api_key_not_found_or_inactive';
  end if;

  insert into public.developer_api_keys (
    id, app_id, name, key_prefix, secret_hash, scopes, expires_at
  ) values (
    p_new_key_id, v_app_id, p_name, p_key_prefix, p_secret_hash, p_scopes, p_expires_at
  );

  update public.developer_api_keys
  set revoked_at = now()
  where id = p_key_id;

  return p_new_key_id;
end;
$$;

revoke all on function public.developer_api_rotate_key(uuid, uuid, uuid, text, text, text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.developer_api_rotate_key(uuid, uuid, uuid, text, text, text, text[], timestamptz) to service_role;

comment on table public.developer_apps is 'Member-owned FreeTrust Developer Hub applications; organization grants are deferred.';
comment on table public.developer_api_keys is 'Hashed FreeTrust API key credentials; plaintext secrets are never persisted.';
comment on table public.developer_api_usage is 'Minimal API request audit/usage data; excludes IPs, user agents, request bodies, and secrets.';
comment on table public.developer_api_rate_state is 'Atomic per-key UTC minute/day quota windows shared across server instances.';
comment on function public.developer_api_consume_quota(uuid, timestamptz, integer, integer) is 'Atomic, service-role-only quota reservation for an active read-only API key.';

notify pgrst, 'reload schema';
