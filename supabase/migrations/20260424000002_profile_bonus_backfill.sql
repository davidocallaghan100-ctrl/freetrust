-- ============================================================================
-- Migration: 20260424000002_profile_bonus_backfill.sql
--
-- Problem:  The `profile_bonus_claimed` column was added with DEFAULT false
--           for all users (fix-new-members.sql line 26). The only place this
--           flag gets set to true is in /api/profile/complete-bonus/route.ts,
--           which is only called when the frontend explicitly POSTs to it.
--           Result: every existing user who has a fully-complete profile AND
--           has never triggered that endpoint still has
--           profile_bonus_claimed = false, leaving them permanently eligible
--           to re-claim (or never having received it in the first place).
--           Only David's account was manually patched.
--
-- Fix (two cases):
--
--   CASE A — user already has a 'profile_complete' row in trust_ledger
--            (they already received ₮10) but profile_bonus_claimed is false.
--            → Set profile_bonus_claimed = true. No new trust issued.
--
--   CASE B — user's profile IS complete (all 7 fields: full_name, bio,
--            avatar_url, cover_url, location, website, username are non-null
--            and non-empty), has NO 'profile_complete' ledger row, and
--            profile_bonus_claimed is false.
--            → Issue ₮10 via issue_trust(), then set profile_bonus_claimed = true.
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ── CASE A: users who already received the bonus but flag wasn't set ─────────
DO $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.profiles p
     SET profile_bonus_claimed = true
   WHERE p.profile_bonus_claimed = false
     AND EXISTS (
           SELECT 1
             FROM public.trust_ledger tl
            WHERE tl.user_id = p.id
              AND tl.type    = 'profile_complete'
         );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Case A: set profile_bonus_claimed = true for % users who already had ledger entry', v_count;
END $$;

-- ── CASE B: users with complete profile who never received the bonus ──────────
DO $$
DECLARE
  rec     RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT p.id AS user_id
      FROM public.profiles p
     WHERE p.profile_bonus_claimed = false
       -- All 7 required profile fields must be non-null and non-empty
       AND p.full_name    IS NOT NULL AND p.full_name    <> ''
       AND p.bio          IS NOT NULL AND p.bio          <> ''
       AND p.avatar_url   IS NOT NULL AND p.avatar_url   <> ''
       AND p.cover_url    IS NOT NULL AND p.cover_url    <> ''
       AND p.location     IS NOT NULL AND p.location     <> ''
       AND p.website      IS NOT NULL AND p.website      <> ''
       AND p.username     IS NOT NULL AND p.username     <> ''
       -- No existing profile_complete ledger row
       AND NOT EXISTS (
             SELECT 1
               FROM public.trust_ledger tl
              WHERE tl.user_id = p.id
                AND tl.type   = 'profile_complete'
           )
  LOOP
    -- Award ₮10 via the same RPC used by the API route
    PERFORM public.issue_trust(
      rec.user_id,
      10,
      'profile_complete',
      NULL,
      'Profile 100% complete bonus (backfill)'
    );

    -- Set the flag
    UPDATE public.profiles
       SET profile_bonus_claimed = true
     WHERE id = rec.user_id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Case B: issued ₮10 and set profile_bonus_claimed = true for % users with complete but unclaimed profiles', v_count;
END $$;

-- ── Verification ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_claimed   integer;
  v_unclaimed integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE profile_bonus_claimed = true),
    COUNT(*) FILTER (WHERE profile_bonus_claimed = false)
  INTO v_claimed, v_unclaimed
  FROM public.profiles;

  RAISE NOTICE 'Verification: % profiles with profile_bonus_claimed=true, % with false',
    v_claimed, v_unclaimed;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
