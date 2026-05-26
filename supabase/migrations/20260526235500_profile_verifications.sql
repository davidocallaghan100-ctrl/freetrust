-- ============================================================================
-- Profile verifications — Stripe Identity integration schema
-- ============================================================================
-- Adds:
--   1. public.profile_verifications     — per-user verification state (private)
--   2. public.profile_verification_badges — public-safe view (status + verified_at only)
--   3. public.grant_verification_bonus(uuid) — idempotent +₮100 bonus grant
--
-- Why a separate table (not a column on profiles):
--   * The existing "Users can update own profile" RLS policy on profiles
--     (migration 20260414000004) is permissive on columns — adding
--     verification state there would let users self-set verified=true.
--   * Verification state must be writable ONLY by service_role (from the
--     Stripe webhook), readable by the owning user, and the verified
--     badge (status + verified_at) must be readable by anyone so the
--     badge can render on other users' profiles.
--   * Keeping the Stripe session id, attempt count, last attempt
--     timestamp PRIVATE to the user — only the public-safe view is
--     exposed broadly.
--
-- ROLLBACK plan (drop in this order to avoid dependency errors):
--   1. DROP FUNCTION IF EXISTS public.grant_verification_bonus(uuid);
--   2. DROP VIEW     IF EXISTS public.profile_verification_badges;
--   3. DROP TABLE    IF EXISTS public.profile_verifications;
--
-- This migration is IDEMPOTENT — re-running it on a DB that already has
-- the table is a no-op (uses IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- ── 1. profile_verifications table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_verifications (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         uuid NOT NULL UNIQUE
                                  REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_verification_session_id  text,
  status                          text NOT NULL DEFAULT 'unverified'
                                  CHECK (status IN ('unverified','pending','verified','failed')),
  verified_at                     timestamptz,
  last_attempt_at                 timestamptz,
  attempt_count                   integer NOT NULL DEFAULT 0,
  bonus_granted_at                timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_verifications_user_id_idx
  ON public.profile_verifications(user_id);

CREATE INDEX IF NOT EXISTS profile_verifications_session_id_idx
  ON public.profile_verifications(stripe_verification_session_id);

-- Touch updated_at on every change. The webhook handler bumps this
-- column implicitly via the standard pattern.
CREATE OR REPLACE FUNCTION public.set_profile_verifications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_verifications_updated_at
  ON public.profile_verifications;
CREATE TRIGGER trg_profile_verifications_updated_at
  BEFORE UPDATE ON public.profile_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_verifications_updated_at();

-- ── 2. RLS — owner-read only, writes only via service_role ─────────────────
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;

-- Drop policies first (idempotency) so re-running this migration is safe.
DROP POLICY IF EXISTS "Users can read their own verification row"
  ON public.profile_verifications;

CREATE POLICY "Users can read their own verification row"
  ON public.profile_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- NO insert/update/delete policies for authenticated — RLS blocks them by
-- default, leaving service_role (used by the Stripe webhook) as the only
-- writer. Belt-and-braces: revoke any prior table-level grants.
REVOKE INSERT, UPDATE, DELETE ON public.profile_verifications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.profile_verifications FROM anon;

-- Grant SELECT to authenticated so the SELECT policy can match.
GRANT SELECT ON public.profile_verifications TO authenticated;

-- ── 3. Public-safe view: profile_verification_badges ──────────────────────
-- Exposes ONLY user_id, status, verified_at. Never the Stripe session
-- id, attempt count, or bonus state. Anyone can SELECT — needed so the
-- green Verified badge can render on other users' profiles and on
-- member-directory cards.
CREATE OR REPLACE VIEW public.profile_verification_badges AS
SELECT
  user_id,
  status,
  verified_at
FROM public.profile_verifications
WHERE status = 'verified';

-- Views inherit RLS from underlying tables by default, but here the
-- view is the public projection of a private table — we want anon +
-- authenticated to read every verified badge regardless of who they
-- are. Mark the view security_invoker = false (definer) so the
-- read uses the view owner's RLS perspective (postgres bypasses RLS).
ALTER VIEW public.profile_verification_badges SET (security_invoker = false);

GRANT SELECT ON public.profile_verification_badges TO authenticated;
GRANT SELECT ON public.profile_verification_badges TO anon;

-- ── 4. grant_verification_bonus(uuid) — idempotent +₮100 award ─────────────
-- Called by the Stripe webhook after the verification_session.verified
-- event lands. Idempotent: re-receiving the event will not double-grant
-- because bonus_granted_at is set inside the same transaction as the
-- issue_trust() call.
--
-- Returns the new trust balance after the grant, or NULL if the bonus
-- was not granted (already granted, or status != 'verified').
CREATE OR REPLACE FUNCTION public.grant_verification_bonus(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row    public.profile_verifications%ROWTYPE;
  v_new    integer;
BEGIN
  -- Lock the row so concurrent webhook receipts can't race past the
  -- bonus_granted_at check. SELECT ... FOR UPDATE blocks the second
  -- invocation until the first commits.
  SELECT * INTO v_row
  FROM public.profile_verifications
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE NOTICE 'grant_verification_bonus: no verification row for user %', p_user_id;
    RETURN NULL;
  END IF;

  IF v_row.status <> 'verified' THEN
    RAISE NOTICE 'grant_verification_bonus: user % not verified (status=%)', p_user_id, v_row.status;
    RETURN NULL;
  END IF;

  IF v_row.bonus_granted_at IS NOT NULL THEN
    -- Already granted — return current balance for caller convenience.
    SELECT balance INTO v_new
    FROM public.trust_balances
    WHERE user_id = p_user_id;
    RETURN v_new;
  END IF;

  -- Mark the bonus as granted FIRST (inside the same transaction as
  -- issue_trust). If issue_trust fails, the whole tx rolls back and
  -- bonus_granted_at remains NULL — safe to retry.
  UPDATE public.profile_verifications
  SET bonus_granted_at = now()
  WHERE user_id = p_user_id;

  PERFORM public.issue_trust(
    p_user_id,
    100,
    'identity_verification_bonus',
    NULL::uuid,
    'Identity verification bonus'
  );

  SELECT balance INTO v_new
  FROM public.trust_balances
  WHERE user_id = p_user_id;

  RETURN v_new;
END;
$$;

-- Bonus grant must NOT be callable by end users. The Stripe webhook
-- runs as service_role; nobody else needs (or should have) this.
REVOKE EXECUTE ON FUNCTION public.grant_verification_bonus(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.grant_verification_bonus(uuid) TO service_role;

-- Force PostgREST to reload its schema cache so the new function/view
-- are visible to admin clients on the very next call.
NOTIFY pgrst, 'reload schema';
