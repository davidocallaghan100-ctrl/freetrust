export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRUST_REWARDS, DELIVERY_TRUST_REWARDS } from '@/lib/trust/rewards'

// Qualifying actions and their Trust rewards.
// Every `amount` here references the canonical catalogue in
// lib/trust/rewards.ts so there is ONE source of truth for reward
// values. Previously this map had drifted: signup_bonus was 25
// (should be 200), complete_profile was 10 (should be 50),
// receive_review was 15 (should be 25), refer_member was 100
// (should be 150), post_article was 20 (should be 75), host_event
// was 15 (should be 50), join_community was 5 (should be 20).
// Every other trust-awarding code path already used TRUST_REWARDS;
// this file was the last hold-out.
const TRUST_ACTIONS: Record<string, { amount: number; label: string; repeatable?: boolean }> = {
  signup_bonus:      { amount: TRUST_REWARDS.SIGNUP_BONUS,      label: 'Welcome bonus'                 },
  complete_profile:  { amount: TRUST_REWARDS.COMPLETE_PROFILE,  label: 'Profile completed to 100%'     },
  first_sale:        { amount: TRUST_REWARDS.COMPLETE_ORDER,    label: 'First completed transaction'   },
  receive_review:    { amount: TRUST_REWARDS.RECEIVE_REVIEW,    label: 'Received a review',       repeatable: true },
  refer_member:      { amount: TRUST_REWARDS.REFER_USER,        label: 'Referred a new member',   repeatable: true },
  post_article:      { amount: TRUST_REWARDS.PUBLISH_ARTICLE,   label: 'Published an article',    repeatable: true },
  host_event:        { amount: TRUST_REWARDS.CREATE_EVENT,      label: 'Hosted an event',         repeatable: true },
  join_community:    { amount: TRUST_REWARDS.JOIN_COMMUNITY,    label: 'Joined a community'            },
  leave_review:      { amount: TRUST_REWARDS.LEAVE_REVIEW,      label: 'Left a review',           repeatable: true },
  donate_impact:     { amount: TRUST_REWARDS.DONATE_IMPACT,     label: 'Donated to the Sustainability Fund', repeatable: true },
  post_liked:        { amount: TRUST_REWARDS.POST_LIKED,        label: 'Your post received a like',   repeatable: true },
  // Actions below are gamification milestones — not in TRUST_REWARDS
  // yet because the qualifying logic lives in the follower-count
  // triggers. Keeping them here as a flat record for now.
  get_10_followers:  { amount: 20,                              label: 'Reached 10 followers'          },
  get_50_followers:  { amount: 30,                              label: 'Reached 50 followers'          },
  get_100_followers: { amount: 50,                              label: 'Reached 100 followers'         },
  make_purchase:     { amount: 5,                               label: 'Made a purchase',         repeatable: true },
  daily_login:       { amount: 1,                               label: 'Daily check-in',          repeatable: true },
  // Delivery rewards — earned automatically on order completion
  delivered_on_time: { amount: DELIVERY_TRUST_REWARDS.DELIVERED_ON_TIME, label: '⚡ On-time delivery (seller)', repeatable: true },
  delivered_late:    { amount: DELIVERY_TRUST_REWARDS.DELIVERED_LATE,    label: '📦 Delivery completed (late)', repeatable: true },
  buyer_confirmed:   { amount: DELIVERY_TRUST_REWARDS.BUYER_CONFIRMED,   label: '✅ Buyer confirmed receipt',   repeatable: true },
  tracking_used:     { amount: DELIVERY_TRUST_REWARDS.TRACKING_USED,     label: '📍 Used live delivery tracking', repeatable: true },
}

// POST /api/trust/action — award trust for a qualifying action
//
// Previously did a non-atomic idempotency-check → insert-ledger →
// read-balance → update-balance pattern that silently failed on the
// final UPDATE because trust_balances has no UPDATE RLS policy.
// See /api/trust/spend/route.ts for the full bug history and the
// companion fix in 20260414000006_wallet_rls.sql.
//
// Fixed to use the issue_trust() SECURITY DEFINER RPC with the
// admin client — same pattern as wallet/transfer, auth/callback,
// signup-bonus, etc.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { action?: string; ref?: string } | null
    const action = body?.action
    const ref = body?.ref

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const actionDef = TRUST_ACTIONS[action]
    if (!actionDef) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const { amount, label, repeatable } = actionDef

    // Idempotency check for non-repeatable actions — look up any
    // existing ledger entry with the same type. Uses the user-session
    // client so RLS scopes the query to this user's own rows.
    if (!repeatable) {
      const { data: existing } = await supabase
        .from('trust_ledger')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', action)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ awarded: false, reason: 'already_awarded', action })
      }
    }

    // Atomic award via the SECURITY DEFINER RPC — bypasses the
    // trust_balances UPDATE policy problem entirely.
    const admin = createAdminClient()
    const { error: rpcError } = await admin.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount:  amount,
      p_type:    action,
      p_ref:     ref ?? null,
      p_desc:    label,
    })

    if (rpcError) {
      console.error('[POST /api/trust/action] issue_trust RPC failed:', {
        message: rpcError.message,
        code:    rpcError.code,
        details: rpcError.details,
        hint:    rpcError.hint,
        action,
      })
      return NextResponse.json(
        { error: rpcError.message || 'Could not award trust' },
        { status: 500 },
      )
    }

    // Read the new balance to echo back to the client so the UI can
    // update without a separate /api/wallet round-trip. This is a
    // SELECT which is allowed by the public-read RLS policy on
    // trust_balances (added by 20260411_trust_balances_public_read.sql).
    const { data: newBal } = await admin
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      awarded: true,
      amount,
      action,
      label,
      newBalance:  newBal?.balance  ?? amount,
      newLifetime: newBal?.lifetime ?? amount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/trust/action] unexpected error:', msg, err)
    return NextResponse.json({ error: `Unexpected error: ${msg}` }, { status: 500 })
  }
}

// GET /api/trust/action — list available actions and which ones this user has completed
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: completed } = await supabase
      .from('trust_ledger')
      .select('type')
      .eq('user_id', user.id)

    const completedTypes = new Set((completed ?? []).map((e: { type: string }) => e.type))

    const actions = Object.entries(TRUST_ACTIONS).map(([key, def]) => ({
      key,
      amount: def.amount,
      label: def.label,
      repeatable: def.repeatable ?? false,
      done: !def.repeatable && completedTypes.has(key),
    }))

    return NextResponse.json({ actions })
  } catch (err) {
    console.error('[GET /api/trust/action]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
