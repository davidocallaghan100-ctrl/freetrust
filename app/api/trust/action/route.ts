export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Qualifying actions and their Trust rewards
const TRUST_ACTIONS: Record<string, { amount: number; label: string; repeatable?: boolean }> = {
  signup_bonus:      { amount: 25,  label: 'Welcome bonus'            },
  complete_profile:  { amount: 10,  label: 'Profile completed to 100%' },
  first_sale:        { amount: 50,  label: 'First completed transaction' },
  receive_review:    { amount: 15,  label: 'Received a review',  repeatable: true },
  refer_member:      { amount: 100, label: 'Referred a new member', repeatable: true },
  post_article:      { amount: 20,  label: 'Published an article', repeatable: true },
  host_event:        { amount: 15,  label: 'Hosted an event', repeatable: true },
  join_community:    { amount: 5,   label: 'Joined a community' },
  get_10_followers:  { amount: 20,  label: 'Reached 10 followers' },
  get_50_followers:  { amount: 30,  label: 'Reached 50 followers' },
  get_100_followers: { amount: 50,  label: 'Reached 100 followers' },
  make_purchase:     { amount: 5,   label: 'Made a purchase', repeatable: true },
  leave_review:      { amount: 10,  label: 'Left a review', repeatable: true },
  daily_login:       { amount: 1,   label: 'Daily check-in', repeatable: true },
}

// POST /api/trust/action — award trust for a qualifying action
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { action: string; ref?: string }
    const { action, ref } = body

    const actionDef = TRUST_ACTIONS[action]
    if (!actionDef) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const { amount, label, repeatable } = actionDef

    // Idempotency check for non-repeatable actions
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

    // Insert ledger entry
    const { error: insertErr } = await supabase
      .from('trust_ledger')
      .insert({
        user_id: user.id,
        amount,
        type: action,
        description: label,
        ref: ref ?? null,
      })

    if (insertErr) {
      // Fall back: try without ref column
      await supabase.from('trust_ledger').insert({
        user_id: user.id,
        amount,
        type: action,
        description: label,
      })
    }

    // Upsert trust balance
    const { data: current } = await supabase
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    if (current) {
      await supabase
        .from('trust_balances')
        .update({
          balance:  (current.balance  ?? 0) + amount,
          lifetime: (current.lifetime ?? 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('trust_balances')
        .insert({ user_id: user.id, balance: amount, lifetime: amount })
    }

    // Get new balance
    const { data: newBal } = await supabase
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      awarded: true,
      amount,
      action,
      label,
      newBalance: newBal?.balance ?? amount,
      newLifetime: newBal?.lifetime ?? amount,
    })
  } catch (err) {
    console.error('[POST /api/trust/action]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
