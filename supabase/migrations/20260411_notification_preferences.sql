-- =============================================================================
-- Email notification preferences
-- One row per (user_id, type). Missing rows default to opted-in (email_enabled
-- = true) via the helper in lib/email/send.ts.
-- =============================================================================

create table if not exists notification_preferences (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  type          text not null,
  email_enabled boolean not null default true,
  push_enabled  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, type)
);

create index if not exists idx_notification_prefs_user on notification_preferences(user_id);

-- Known notification types (for docs / validation). Not a CHECK constraint
-- so new types can be added without a schema change.
comment on table notification_preferences is
  'Per-user email/push preferences. Known types: welcome, new_follower,
   new_message, order_placed, order_delivered, order_dispatched, order_completed,
   order_disputed, new_comment, new_reaction, wallet_topup, transfer_received,
   referral_joined, referral_reward, new_job_application, event_reminder,
   trust_badge, weekly_digest, review_received, trust_milestone';

alter table notification_preferences enable row level security;

-- Users can view their own preferences
do $$ begin
  if not exists (select 1 from pg_policies where tablename='notification_preferences' and policyname='Users view own prefs') then
    create policy "Users view own prefs"
      on notification_preferences for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Users can upsert their own preferences
do $$ begin
  if not exists (select 1 from pg_policies where tablename='notification_preferences' and policyname='Users insert own prefs') then
    create policy "Users insert own prefs"
      on notification_preferences for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='notification_preferences' and policyname='Users update own prefs') then
    create policy "Users update own prefs"
      on notification_preferences for update
      using (auth.uid() = user_id);
  end if;
  -- Service role can do anything
  if not exists (select 1 from pg_policies where tablename='notification_preferences' and policyname='Service role manages prefs') then
    create policy "Service role manages prefs"
      on notification_preferences for all
      using (auth.role() = 'service_role');
  end if;
end $$;
