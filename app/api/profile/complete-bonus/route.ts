export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardTrust } from '@/lib/trust/award'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'

// POST /api/profile/complete-bonus — award the profile-100% bonus
//
// INTEGRITY AUDIT FIX (2026-04-15):
// Before this commit the route directly UPDATE'd two columns on the
// profiles table:
//
//   .update({ trust_balance: newBalance, profile_bonus_claimed: true })
//
// The `profiles.trust_balance` column is a denormalised cache that
// exists alongside the canonical `trust_balances.balance` column —
// so every award via this route left the two fields out of sync.
// Worse, the route then inserted a raw row into trust_ledger WITHOUT
// going through issue_trust(), so trust_balances.balance never moved
// at all. Net result: the user's wallet showed stale balance, feed
// components (which read from profiles.trust_balance) showed a
// different number, and trust_ledger was a polluted mess of orphaned
// inserts. This is one of the two call-site bugs flagged by the
// trust economy integrity audit.
//
// Fix: route the award through awardTrust() which calls the
// issue_trust() SECURITY DEFINER RPC. A new BEFORE UPDATE trigger
// (see 20260415000003_trust_reconciliation.sql) enforces that
// trust_balances can only be mutated through the RPC, and a
// companion AFTER trigger mirrors the canonical balance into
// profiles.trust_balance so the denormalised cache stays in sync
// automatically. profile_bonus_claimed is the only column this
// route still touches directly — it's a boolean flag specific to
// this claim, not trust state.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch current profile
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('full_name, bio, avatar_url, cover_url, location, website, username, profile_bonus_claimed')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.profile_bonus_claimed) {
      return NextResponse.json({ alreadyClaimed: true, bonus: 0 })
    }

    // Check completeness — 7 fields
    const fields = [
      profile.full_name,
      profile.bio,
      profile.avatar_url,
      profile.cover_url,
      profile.location,
      profile.website,
      profile.username,
    ]
    const filledCount = fields.filter(Boolean).length
    const isComplete = filledCount >= 7

    if (!isComplete) {
      return NextResponse.json({
        alreadyClaimed: false,
        bonus: 0,
        filledCount,
        message: 'Profile not yet 100% complete',
      })
    }

    // Flip the claimed flag BEFORE issuing trust so the route is
    // idempotent against concurrent callers — a second call arriving
    // in the same millisecond will see profile_bonus_claimed=true
    // and short-circuit. The worst case is a lost trust award if
    // awardTrust() throws after this update, which is recoverable
    // via the reconcile_trust_balances RPC.
    const { error: flagErr } = await admin
      .from('profiles')
      .update({ profile_bonus_claimed: true })
      .eq('id', user.id)
      .eq('profile_bonus_claimed', false)

    if (flagErr) {
      console.error('[complete-bonus] flag update failed:', flagErr)
      return NextResponse.json({ error: 'Failed to claim bonus' }, { status: 500 })
    }

    const awardResult = await awardTrust({
      userId: user.id,
      amount: TRUST_REWARDS.COMPLETE_PROFILE,
      type:   TRUST_LEDGER_TYPES.COMPLETE_PROFILE,
      ref:    null,
      desc:   'Profile 100% complete bonus',
    })

    if (!awardResult.ok) {
      // Roll back the flag so the user can retry. This is not
      // transactional with the trust award — if the rollback fails
      // the user has a stuck flag, surfaced via the reconcile RPC.
      await admin
        .from('profiles')
        .update({ profile_bonus_claimed: false })
        .eq('id', user.id)
      return NextResponse.json(
        { error: awardResult.error ?? 'Failed to award trust' },
        { status: 500 },
      )
    }

    // Read back the canonical balance from trust_balances (the
    // denormalised profiles.trust_balance mirror is kept in sync
    // by a DB trigger, but we prefer the source of truth).
    const { data: balRow } = await admin
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      bonus: awardResult.amount,
      newBalance: balRow?.balance ?? null,
      claimed: true,
    })
  } catch (err) {
    console.error('[complete-bonus] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
