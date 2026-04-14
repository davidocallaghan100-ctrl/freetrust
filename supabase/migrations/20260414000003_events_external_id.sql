-- ============================================================================
-- Add external-source columns to events (for Eventbrite + future sync sources)
-- ============================================================================
-- Lets us import events from third-party platforms (Eventbrite first) and
-- dedup on re-sync via a stable external identifier. Required by
-- app/api/events/sync-eventbrite/route.ts.
--
-- Columns:
--   external_id      — the third-party event id, e.g. Eventbrite's 123456789
--   external_source  — which platform the event came from ('eventbrite')
--   external_url     — canonical URL on the source platform, so clicking
--                      through from the feed goes to the real booking page
--                      (added per the STEP 3 field mapping which listed
--                      url → external_url; not in the original STEP 4 spec
--                      but dropping it would make the sync decorative —
--                      users wouldn't have a way to actually book a ticket).
--
-- All three are nullable — hand-created events have NULL external_id,
-- and the unique index below is partial so NULL values don't conflict.
--
-- Idempotent: all three ADD COLUMNs use IF NOT EXISTS, both CREATE INDEXes
-- use IF NOT EXISTS.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS external_id     text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_url    text;

-- Unique partial index — the dedup key for re-syncs. Partial (WHERE NOT
-- NULL) so hand-created events (with external_id = NULL) don't conflict
-- with each other. PostgreSQL's unique index implementation treats NULLs
-- as distinct, but the partial predicate makes the intent explicit.
CREATE UNIQUE INDEX IF NOT EXISTS events_external_id_idx
  ON public.events (external_id)
  WHERE external_id IS NOT NULL;

-- Non-unique index on external_source so we can cheaply query
-- "all events imported from eventbrite" for reconciliation, bulk
-- delete, or a per-source admin dashboard later.
CREATE INDEX IF NOT EXISTS events_external_source_idx
  ON public.events (external_source)
  WHERE external_source IS NOT NULL;

-- Table-level re-grant so PostgREST picks up the new columns
-- (column-level grants would mask them otherwise — see commit
-- 20260413000001_listings_category_column.sql for the bug history).
GRANT SELECT, INSERT, UPDATE ON public.events TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
