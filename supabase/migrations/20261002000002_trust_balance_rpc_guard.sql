-- Keep the production trust-balance drift guard while allowing the canonical
-- server-side RPCs to update balances. The guard was installed in production
-- before it was captured in the repository; without this context flag every
-- Agent credit debit fails before the model can run.

create or replace function public.enforce_balance_update_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.balance is distinct from new.balance then
    if current_setting('app.allow_balance_update', true) is distinct from 'yes' then
      raise exception
        'direct trust_balances.balance UPDATE is forbidden — call issue_trust(), spend_trust(), donate_to_impact_fund() or reconcile_trust_balances() instead'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trust_balances_drift_guard on public.trust_balances;
create trigger trust_balances_drift_guard
before update of balance on public.trust_balances
for each row execute function public.enforce_balance_update_guard();

create or replace function public.issue_trust(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_ref uuid,
  p_desc text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'issue_trust is server-only';
  end if;
  if p_user_id is null or p_amount is null or p_amount = 0 then
    raise exception 'invalid Trust Coin award';
  end if;

  perform set_config('app.allow_balance_update', 'yes', true);

  insert into public.trust_ledger (user_id, amount, type, reference_id, description)
  values (p_user_id, p_amount, p_type, p_ref, p_desc);

  insert into public.trust_balances (user_id, balance, lifetime)
  values (p_user_id, p_amount, p_amount)
  on conflict (user_id) do update set
    balance = public.trust_balances.balance + p_amount,
    lifetime = public.trust_balances.lifetime + greatest(p_amount, 0),
    updated_at = now();
end;
$$;

create or replace function public.spend_trust(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_desc text
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current integer;
  v_new integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'spend_trust is server-only';
  end if;
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount: p_amount must be a positive integer';
  end if;

  perform set_config('app.allow_balance_update', 'yes', true);

  select balance into v_current
    from public.trust_balances
    where user_id = p_user_id
    for update;

  if not found or v_current < p_amount then
    raise exception 'insufficient_funds: requested %, available %', p_amount, coalesce(v_current, 0);
  end if;

  update public.trust_balances
    set balance = balance - p_amount, updated_at = now()
    where user_id = p_user_id
    returning balance into v_new;

  insert into public.trust_ledger (user_id, amount, type, description)
  values (p_user_id, -p_amount, p_type, p_desc);

  return v_new;
end;
$$;

create or replace function public.donate_to_impact_fund(
  p_user_id uuid,
  p_amount integer,
  p_project_id uuid default null,
  p_desc text default 'Sustainability Fund donation'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_new_fund integer;
  v_new_user integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount: must be positive (got %)', p_amount
      using errcode = 'P0001';
  end if;

  perform set_config('app.allow_balance_update', 'yes', true);

  select balance into v_current
    from public.trust_balances
    where user_id = p_user_id
    for update;

  if not found then
    raise exception 'insufficient_funds: no balance row (requested %, available 0)', p_amount
      using errcode = 'P0001';
  end if;

  if v_current < p_amount then
    raise exception 'insufficient_funds: requested %, available %', p_amount, v_current
      using errcode = 'P0001';
  end if;

  update public.trust_balances
    set balance = balance - p_amount, updated_at = now()
    where user_id = p_user_id
    returning balance into v_new_user;

  insert into public.trust_ledger (user_id, amount, type, reference_id, description)
  values (p_user_id, -p_amount, 'impact_donation', p_project_id, p_desc);

  update public.impact_fund_balance
    set balance = balance + p_amount,
        lifetime = lifetime + p_amount,
        updated_at = now()
    where id = 1
    returning balance into v_new_fund;

  if v_new_fund is null then
    insert into public.impact_fund_balance (id, balance, lifetime)
    values (1, p_amount, p_amount)
    returning balance into v_new_fund;
  end if;

  insert into public.impact_donations (user_id, project_id, amount)
  values (p_user_id, p_project_id, p_amount);

  if p_project_id is not null then
    update public.impact_projects
      set raised = coalesce(raised, 0) + p_amount,
          backers = coalesce(backers, 0) + 1,
          updated_at = now()
      where id = p_project_id;
  end if;

  return jsonb_build_object(
    'new_fund_balance', v_new_fund,
    'new_user_balance', v_new_user,
    'amount_donated', p_amount,
    'project_id', p_project_id
  );
end;
$$;

revoke all on function public.issue_trust(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.spend_trust(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.issue_trust(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.spend_trust(uuid, integer, text, text) to service_role;

notify pgrst, 'reload schema';
