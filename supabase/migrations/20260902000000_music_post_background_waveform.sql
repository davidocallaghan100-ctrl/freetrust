-- Music posts: optional member artwork and a bounded precomputed waveform.
-- The waveform is stored as normalized JSONB peaks (0..1, max 160 values)
-- so feed cards do not need to download/decode the full track on every render.
-- Application routes validate and normalize both fields before writing them.

alter table public.feed_posts
  add column if not exists music_background_url text,
  add column if not exists music_waveform jsonb;

comment on column public.feed_posts.music_background_url is
  'Optional public image URL shown behind the FreeTrust Music post artwork.';

comment on column public.feed_posts.music_waveform is
  'Optional normalized waveform peaks for Music posts; application-bounded to at most 160 values.';
