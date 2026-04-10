-- Add all extended profile columns that the application code expects
-- These were not in the original schema.sql but are required by onboarding,
-- settings, and profile pages.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username          text UNIQUE,
  ADD COLUMN IF NOT EXISTS cover_url         text,
  ADD COLUMN IF NOT EXISTS website           text,
  ADD COLUMN IF NOT EXISTS account_type      text NOT NULL DEFAULT 'individual'
                                               CHECK (account_type IN ('individual', 'business')),
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skills            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interests         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS purpose           text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS follower_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS privacy_settings  jsonb,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb,
  ADD COLUMN IF NOT EXISTS stripe_account_id text;
