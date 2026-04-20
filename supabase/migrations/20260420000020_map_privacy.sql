-- Add map privacy toggle to profiles
-- Allows users to opt out of appearing on the Activity Map
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_on_map boolean NOT NULL DEFAULT true;
