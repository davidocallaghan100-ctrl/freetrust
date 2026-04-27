-- Idempotency log for the scheduled-post-fanout cron.
-- One row per post that has been fanned out. The unique constraint on
-- post_id (primary key) prevents double-sends if the cron overlaps.
create table if not exists public.cron_fanout_log (
  post_id       text        primary key,
  fanned_out_at timestamptz not null default now()
);
