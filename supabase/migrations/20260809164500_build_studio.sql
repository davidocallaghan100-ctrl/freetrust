-- Build — AI architecture design studio
--
-- New tables only. Does not modify any existing table. RLS enforced via
-- a redundant user_id column on every table (simplest, most auditable
-- policy shape — avoids sub-selects into build_conversations on every
-- child-row check).
--
-- build_conversations: one row per Build chat/design thread.
-- build_messages: chat turns; design_spec holds the parsed JSON design
--   spec attached to that specific AI turn (null for user turns or AI
--   turns that failed to produce a valid spec).
-- build_sections: one row per (conversation, section_key) — the 12-tab
--   system. Core sections (brief, design, build_sequence) are written
--   here too so "Documents & Downloads" PDF export can pull everything
--   from one place, but they are never separately charged — only the
--   9 on-demand sections cost Trust Coins to (re)generate.

CREATE TABLE IF NOT EXISTS public.build_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'Untitled design',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS build_conversations_user_id_idx
  ON public.build_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.build_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.build_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  design_spec     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS build_messages_conversation_id_idx
  ON public.build_messages (conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.build_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.build_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key     text NOT NULL CHECK (section_key IN (
                     'brief', 'planning', 'design', 'engineering', 'costing',
                     'build_sequence', 'services', 'finishes', 'timeline',
                     'sustainability', 'safety'
                   )),
  content         text NOT NULL,
  cost_spent      integer NOT NULL DEFAULT 0,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, section_key)
);

CREATE INDEX IF NOT EXISTS build_sections_conversation_id_idx
  ON public.build_sections (conversation_id);

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.build_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_sections      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='build_conversations' AND policyname='build_conversations_owner_all'
  ) THEN
    CREATE POLICY build_conversations_owner_all ON public.build_conversations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='build_messages' AND policyname='build_messages_owner_all'
  ) THEN
    CREATE POLICY build_messages_owner_all ON public.build_messages
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='build_sections' AND policyname='build_sections_owner_all'
  ) THEN
    CREATE POLICY build_sections_owner_all ON public.build_sections
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.build_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS build_conversations_touch ON public.build_conversations;
CREATE TRIGGER build_conversations_touch
  BEFORE UPDATE ON public.build_conversations
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

DROP TRIGGER IF EXISTS build_sections_touch ON public.build_sections;
CREATE TRIGGER build_sections_touch
  BEFORE UPDATE ON public.build_sections
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();
