export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SPEND_ACTIONS: Record<string, { cost: number; label: string }> = {
  boost_listing:    { cost: 200, label: 'Boost Listing (7 days)'         },
  offset_fees:      { cost: 100, label: 'Fee offset (₮100 = €1)'         },
  donate_impact:    { cost: 50,  label: 'Impact Fund donation (₮50 = €0.50)' },
  unlock_badge:     { cost: 150, label: 'Early Supporter badge unlocked'  },
  featured_profile: { cost: 300, label: 'Featured Profile (3 days)'       },
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { action: string; amount?: number }
    const { action } = body

    const def = SPEND_ACTIONS[action]
    if (!def) {
      return NextResponse.json({ error: 'Unknown spend action' }, { status: 400 })
    }

    // Check balance
    const { data: bal } = await supabase
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    const current = bal?.balance ?? 0
    if (current < def.cost) {
      return NextResponse.json({ error: 'Insufficient trust balance', balance: current }, { status: 402 })
    }

    // Deduct from balance — insert negative ledger entry
    await supabase.from('trust_ledger').insert({
      user_id: user.id,
      amount: -def.cost,
      type: `spend_${action}`,
      description: def.label,
    })

    // Update balance (do NOT reduce lifetime — it tracks all-time earned)
    await supabase
      .from('trust_balances')
      .update({ balance: current - def.cost, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    const newBalance = current - def.cost

    return NextResponse.json({ success: true, action, cost: def.cost, newBalance, label: def.label })
  } catch (err) {
    console.error('[POST /api/trust/spend]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
