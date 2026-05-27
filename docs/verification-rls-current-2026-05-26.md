# FreeTrust profile verification RLS audit

Date: 2026-05-26  
Scope: read-only audit of current production policies plus proposed SQL hardening. No migration has been applied.

## Current production policies

Captured from `pg_policies` on the FreeTrust Supabase project for `profiles` and verification-adjacent tables.

### `public.profiles`

```sql
create policy "Profiles are viewable by everyone" on public.profiles
  as PERMISSIVE
  for SELECT
  to public
  using (true);

create policy "Service role can insert profiles" on public.profiles
  as PERMISSIVE
  for INSERT
  to public
  with check (true);

create policy "Users can update own profile" on public.profiles
  as PERMISSIVE
  for UPDATE
  to public
  using ((auth.uid() = id));
```

### Verification-adjacent financial/trust tables

```sql
create policy "Trust balances are public" on public.trust_balances
  as PERMISSIVE
  for SELECT
  to public
  using (true);

create policy "Users can insert own balance row" on public.trust_balances
  as PERMISSIVE
  for INSERT
  to public
  with check ((auth.uid() = user_id));

create policy "Users can update own balance" on public.trust_balances
  as PERMISSIVE
  for UPDATE
  to authenticated
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

create policy "Users can insert own ledger entry" on public.trust_ledger
  as PERMISSIVE
  for INSERT
  to public
  with check ((auth.uid() = user_id));

create policy "Users can view own ledger" on public.trust_ledger
  as PERMISSIVE
  for SELECT
  to public
  using ((auth.uid() = user_id));

create policy "Users view own ledger" on public.trust_ledger
  as PERMISSIVE
  for SELECT
  to public
  using ((auth.uid() = user_id));
```

```sql
create policy "Service role full access" on public.money_deposits
  as PERMISSIVE
  for ALL
  to public
  using (true);

create policy "Service role manages deposits" on public.money_deposits
  as PERMISSIVE
  for ALL
  to public
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

create policy "Users can view own deposits" on public.money_deposits
  as PERMISSIVE
  for SELECT
  to public
  using ((auth.uid() = user_id));
```

```sql
create policy "Service role full access" on public.wallet_transfers
  as PERMISSIVE
  for ALL
  to public
  using (true);

create policy "Users can view own transfers" on public.wallet_transfers
  as PERMISSIVE
  for SELECT
  to public
  using (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));
```

```sql
create policy "Authenticated users can insert own donation" on public.impact_donations
  as PERMISSIVE
  for INSERT
  to authenticated
  with check ((auth.uid() = user_id));

create policy "Public can read donations for leaderboard" on public.impact_donations
  as PERMISSIVE
  for SELECT
  to public
  using (true);

create policy "Service role manages donations" on public.impact_donations
  as PERMISSIVE
  for ALL
  to public
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

create policy "Users can view own donations" on public.impact_donations
  as PERMISSIVE
  for SELECT
  to public
  using ((auth.uid() = user_id));
```

`profile_verifications` does not exist in production yet, so it has no current policies.

## RLS/security findings

1. `profiles` public SELECT is expected because public member/profile pages need public profile data.
2. `profiles` owner UPDATE is too broad for a trust platform. PostgreSQL RLS policies do not limit columns by themselves, so this policy allows any column update by the owner unless a trigger blocks restricted fields.
3. `profiles` insert policy is named for service role but currently grants `to public with check (true)`. Profile creation should be restricted to `service_role` / trusted server-side paths.
4. `trust_balances`, `trust_ledger`, `money_deposits`, and `wallet_transfers` have legacy broad write policies. This Phase 2A migration focuses on `profiles`, but those policies should be reviewed in a later wallet hardening pass because Trust balances should only change through `issue_trust`, `spend_trust`, or `donate_to_impact_fund`.
5. Existing route `app/api/profile/complete-bonus/route.ts` still appears to update `profiles.trust_balance` / `profile_bonus_claimed` directly. The proposed profile hardening intentionally blocks normal user-authenticated writes to balance-related profile fields; if that legacy route is still used, it should be converted in a separate approved phase to call the existing trust RPC pattern before this migration is applied.

## Proposed hardened `profiles` SQL

The migration file is `supabase/migrations/20260526235000_harden_profiles_rls.sql`.

Key approach:

- Keep public profile reads.
- Restrict profile inserts to service role.
- Keep owner profile updates for legitimate editable fields, but add a `BEFORE UPDATE` trigger that rejects changes to restricted columns unless the request is service role.
- Block user writes to verification fields, future `trust_tier`, future verification session columns, admin flags, and balance/bonus columns.
- Add `profile_verification_badges`, a public-safe view that exposes only verified badge state (`user_id`, `status`, `verified_at`) and never Stripe session IDs or identity evidence.

```sql
alter table public.profiles enable row level security;

drop policy if exists "Service role can insert profiles" on public.profiles;
create policy "Service role can insert profiles"
  on public.profiles
  for insert
  to public
  with check (auth.role() = 'service_role');

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own safe profile fields"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.prevent_profile_restricted_field_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  restricted_columns text[] := array[
    'is_admin',
    'is_verified',
    'verified_at',
    'verified_by',
    'verification_status',
    'verification_submitted_at',
    'verification_verified_at',
    'verification_rejected_at',
    'verification_reviewed_by',
    'verification_method',
    'verification_notes',
    'verification_session_id',
    'stripe_verification_session_id',
    'trust_tier',
    'trust_balance',
    'profile_bonus_claimed'
  ];
  column_name text;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  foreach column_name in array restricted_columns loop
    if (to_jsonb(old) ? column_name)
       and ((to_jsonb(old) -> column_name) is distinct from (to_jsonb(new) -> column_name)) then
      raise exception 'restricted_profile_field_update: % may only be changed by service role', column_name
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_restricted_field_updates on public.profiles;
create trigger trg_prevent_profile_restricted_field_updates
  before update on public.profiles
  for each row execute function public.prevent_profile_restricted_field_updates();
```

## Plain-English diff

- **Before:** any logged-in user could update their own `profiles` row under RLS. Server routes tried to whitelist safe fields, but a direct Supabase client request could target sensitive columns.
- **After:** logged-in users can still update their own profile, but the database rejects sensitive field changes before the row is written.
- **Before:** the profile insert policy name implied service-role-only behavior, but SQL allowed public inserts.
- **After:** profile inserts require `auth.role() = 'service_role'`, preserving trusted signup trigger/server creation paths while blocking arbitrary public inserts.
- **Before:** verification state lived on mutable profile columns with no hard database guard.
- **After:** verification grant fields are service-role-only at the database boundary. The separate `profile_verifications` migration adds the Stripe Identity status/audit row and bonus idempotency guard.

## Not applied

This audit and the migration SQL are staged for review only. Production migrations still require explicit approval before execution.
