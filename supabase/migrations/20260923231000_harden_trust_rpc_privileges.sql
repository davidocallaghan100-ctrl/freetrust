-- Trust balances are financial state. The SECURITY DEFINER RPCs must only be
-- callable by trusted server code using the Supabase service-role connection.
-- Application routes authenticate the member first, then invoke these RPCs
-- with the admin client; browser/anon callers must not be able to mint or
-- debit Trust Coin directly.

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
  if current_user <> 'service_role' then
    raise exception 'issue_trust is server-only';
  end if;
  if p_user_id is null or p_amount is null or p_amount = 0 then
    raise exception 'invalid Trust Coin award';
  end if;

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
  if current_user <> 'service_role' then
    raise exception 'spend_trust is server-only';
  end if;
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount: p_amount must be a positive integer';
  end if;

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

revoke all on function public.issue_trust(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.spend_trust(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.issue_trust(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.spend_trust(uuid, integer, text, text) to service_role;

notify pgrst, 'reload schema';
