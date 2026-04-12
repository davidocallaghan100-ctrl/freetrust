-- =============================================================================
-- feed-media storage bucket + RLS policies for direct client uploads
--
-- This enables the create page to upload photos/videos directly from the
-- browser to Supabase storage, bypassing the Next.js API route entirely.
-- That bypasses Vercel's 4.5 MB body size limit on Hobby plans (a common
-- cause of silent upload failures) and avoids the serverless memory cost
-- of buffering large videos server-side.
--
-- Run this once in the Supabase SQL editor.
-- =============================================================================

-- ── 1. Create the bucket ─────────────────────────────────────────────────────
-- No allowed_mime_types restriction at the bucket level — we validate in
-- the application layer instead so new formats (HEIC, etc.) can be added
-- without a schema change.
insert into storage.buckets (id, name, public, file_size_limit)
values ('feed-media', 'feed-media', true, 104857600) -- 100 MB
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- ── 2. RLS policies on storage.objects ──────────────────────────────────────
-- Supabase's storage.objects is already RLS-enabled. We add policies that
-- scope uploads and reads to the feed-media bucket.

-- Allow authenticated users to INSERT files into feed-media, restricted
-- to a folder named with their own user id (so users can't overwrite each
-- other's files). Path format: "<kind>/<user_id>/<filename>"
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feed-media authenticated insert'
  ) then
    create policy "feed-media authenticated insert"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'feed-media'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;

-- Allow anyone (even unauthenticated) to SELECT files from feed-media.
-- The bucket is public so this just enables the SQL-level read path;
-- the storage REST API respects bucket.public independently.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feed-media public read'
  ) then
    create policy "feed-media public read"
      on storage.objects for select
      using (bucket_id = 'feed-media');
  end if;
end $$;

-- Allow users to delete their own files (tidying up after failed uploads,
-- removing uploaded media when deleting a post, etc.)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feed-media user delete own'
  ) then
    create policy "feed-media user delete own"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'feed-media'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;

-- Service role bypass — API routes using the admin client can do anything
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feed-media service role all'
  ) then
    create policy "feed-media service role all"
      on storage.objects for all
      using (bucket_id = 'feed-media' and auth.role() = 'service_role');
  end if;
end $$;
