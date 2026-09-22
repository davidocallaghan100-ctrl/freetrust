-- Messaging compatibility repair.
-- Older production databases can have public.messages without the metadata
-- column even though current message APIs and structured receipts use it.
-- This is additive and idempotent; the API also keeps a legacy read fallback
-- so ordinary conversations remain readable before this migration is applied.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
