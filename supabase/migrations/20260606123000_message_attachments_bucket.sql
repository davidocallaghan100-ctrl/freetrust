-- ============================================================================
-- Messaging phase 2 — private Supabase Storage bucket for message attachments
-- ============================================================================
-- Manual migration for Supabase SQL Editor. Do not auto-apply from the agent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760, -- 10 MB per file
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path format used by the app:
--   <uploader_user_id>/<conversation_id>/<timestamp-random-safe_filename>
-- This keeps write access scoped to the uploader while read access is scoped
-- to conversation participants.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'message-attachments participant read'
  ) then
    create policy "message-attachments participant read"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'message-attachments'
        and public.is_conversation_participant(((storage.foldername(name))[2])::uuid)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'message-attachments participant insert own folder'
  ) then
    create policy "message-attachments participant insert own folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'message-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.is_conversation_participant(((storage.foldername(name))[2])::uuid)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'message-attachments uploader delete own'
  ) then
    create policy "message-attachments uploader delete own"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'message-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'message-attachments service role all'
  ) then
    create policy "message-attachments service role all"
      on storage.objects for all
      using (bucket_id = 'message-attachments' and auth.role() = 'service_role')
      with check (bucket_id = 'message-attachments' and auth.role() = 'service_role');
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
