-- Allow public read of trust_balances so other users' trust scores show on
-- collab/people, profile pages, leaderboards, member cards, etc.
-- Trust score is a public reputation metric — not sensitive data.
-- Writes/updates are still restricted: only the issue_trust() RPC (security definer)
-- and the service-role client can mutate balances.

-- Drop the restrictive "view own only" policy if it exists
do $$ begin
  if exists (
    select 1 from pg_policies
    where tablename = 'trust_balances'
      and policyname = 'Users view own balance'
  ) then
    drop policy "Users view own balance" on trust_balances;
  end if;
end $$;

-- Add a public read policy
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'trust_balances'
      and policyname = 'Trust balances are public'
  ) then
    create policy "Trust balances are public"
      on trust_balances for select
      using (true);
  end if;
end $$;
