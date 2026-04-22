-- Add organisation support to jobs table
-- Allows admins to post jobs on behalf of an organisation (LinkedIn-style)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jobs_org_id_idx ON public.jobs(org_id);
