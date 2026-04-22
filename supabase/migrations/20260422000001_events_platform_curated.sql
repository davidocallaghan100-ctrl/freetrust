-- Add is_platform_curated flag to events table
-- Platform-curated events are inserted by FreeTrust staff/agents and shown
-- with a "Curated by FreeTrust" badge instead of the creator's name.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_platform_curated boolean NOT NULL DEFAULT false;

-- Index to quickly fetch curated events for the homepage / featured sections
CREATE INDEX IF NOT EXISTS idx_events_platform_curated
  ON events (is_platform_curated)
  WHERE is_platform_curated = true;

COMMENT ON COLUMN events.is_platform_curated IS
  'When true, this event was added by FreeTrust platform staff/agents. Shows a "Curated by FreeTrust" badge in the UI.';
