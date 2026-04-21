-- Add company/business details to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_name        text,
  ADD COLUMN IF NOT EXISTS company_logo_url    text,
  ADD COLUMN IF NOT EXISTS company_website     text,
  ADD COLUMN IF NOT EXISTS company_size        text,
  ADD COLUMN IF NOT EXISTS company_description text;

-- Create a storage bucket for company logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-logos', 'company-logos', true, 2097152, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to company-logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'Auth users can upload company logos'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Auth users can upload company logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'company-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'Company logos are public'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Company logos are public"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'company-logos');
  END IF;
END $$;
