-- Add stripe_onboarded column referenced by /api/stripe/connect and the
-- Stripe webhook handler (handleAccountUpdated). Without this column the
-- .select('stripe_account_id, stripe_onboarded') query in the Connect route
-- returns a PostgREST "column does not exist" error. The route silently
-- swallows it (destructure ignores error) so `profile` ends up null, which
-- breaks the Withdraw Earnings button flow — the client gets either a
-- 500 or an infinite onboarding redirect loop because the code can never
-- detect that the user has already finished Stripe Connect onboarding.
--
-- This migration is idempotent and safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_onboarded boolean NOT NULL DEFAULT false;

-- Index so handleAccountUpdated's
--   .eq('stripe_account_id', account.id).eq('stripe_onboarded', false)
-- lookup is fast even at scale
CREATE INDEX IF NOT EXISTS profiles_stripe_account_id_idx
  ON profiles (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;
