-- Add missing UPDATE and DELETE policies for covers storage bucket.
-- The INSERT policy already existed but upsert operations require UPDATE
-- permission too, which was causing cover photo uploads to silently fail.

CREATE POLICY "covers_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "covers_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
