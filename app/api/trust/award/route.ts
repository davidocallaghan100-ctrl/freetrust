export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/trust/award — award trust for a specific reason (idempotent by reason)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { amount?: number; reason?: string }
    const amount = Number(body.amount ?? 0)
    const reason = body.reason ?? 'award'

    if (amount <= 0 || amount > 100) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Check idempotency — don't award same reason twice
    const { data: existing } = await supabase
      .from('trust_ledger')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'award')
      .eq('description', reason)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ awarded: false, reason: 'already_awarded' })
    }

    // Insert ledger entry
    await supabase
      .from('trust_ledger')
      .insert({ user_id: user.id, amount, type: 'award', description: reason })

    // Update balance
    const { data: current } = await supabase
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    if (current) {
      await supabase
        .from('trust_balances')
        .update({
          balance: (current.balance ?? 0) + amount,
          lifetime: (current.lifetime ?? 0) + amount,
        })
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('trust_balances')
        .insert({ user_id: user.id, balance: amount, lifetime: amount })
    }

    return NextResponse.json({ awarded: true, amount })
  } catch (err) {
    console.error('[trust/award] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
