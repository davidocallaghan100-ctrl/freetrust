-- ============================================================================
-- Build — reference image attachments on chat messages
-- ============================================================================
-- Adds image_urls to the existing build_messages table (does NOT touch the
-- already-applied 20260809164500_build_studio.sql migration) and a new
-- private Storage bucket for the uploaded reference photos.
--
-- Applied ONLY to the FreeTrust Supabase project (ref tioqakxnqjxyuzgnwhrb).
-- Safe to re-run — every statement is idempotent.

-- ── 1. image_urls column ────────────────────────────────────────────────────
-- Follows the same jsonb-array convention already used for the messaging
-- feature's messages.attachments column (see
-- 20260606120000_message_replies_attachments_reads.sql): a jsonb array of
-- Storage object paths (NOT public URLs — the bucket is private, so the
-- client resolves each path to a short-lived signed URL for display, same
-- pattern as lib/messageAttachments.ts).
ALTER TABLE public.build_messages
  ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'build_messages_image_urls_is_array'
  ) THEN
    ALTER TABLE public.build_messages
      ADD CONSTRAINT build_messages_image_urls_is_array
      CHECK (jsonb_typeof(image_urls) = 'array');
  END IF;
END $$;

-- ── 2. Storage bucket ────────────────────────────────────────────────────────
-- Private bucket — reference photos of a member's own site/house are not
-- public content. Images only (jpg/png/webp/heic/heif), 10 MB per file
-- cap, consistent with the limits already used by
-- lib/messageAttachments.ts and app/api/upload/avatar/route.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'build-attachments',
  'build-attachments',
  false,
  10485760, -- 10 MB per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path format used by the app:  <user_id>/<timestamp>-<random>-<safe_name>.<ext>
-- Build conversations are single-owner (no participants, unlike messaging),
-- so RLS only needs to check the top-level folder against auth.uid() —
-- no conversation-participant lookup required.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'build-attachments owner select'
  ) THEN
    CREATE POLICY "build-attachments owner select"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'build-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'build-attachments owner insert'
  ) THEN
    CREATE POLICY "build-attachments owner insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'build-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'build-attachments owner delete'
  ) THEN
    CREATE POLICY "build-attachments owner delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'build-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'build-attachments service role all'
  ) THEN
    CREATE POLICY "build-attachments service role all"
      ON storage.objects FOR ALL
      USING (bucket_id = 'build-attachments' AND auth.role() = 'service_role')
      WITH CHECK (bucket_id = 'build-attachments' AND auth.role() = 'service_role');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
