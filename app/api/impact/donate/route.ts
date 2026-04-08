import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { project_id, amount } = body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Check user has sufficient trust balance
    const { data: balanceData } = await supabase
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    const currentBalance = balanceData?.balance ?? 0
    if (currentBalance < amount) {
      return NextResponse.json({ error: 'Insufficient trust balance' }, { status: 400 })
    }

    // Deduct trust via issue_trust with negative amount
    const { error: trustError } = await supabase.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount: -Math.floor(amount),
      p_type: 'impact_donation',
      p_ref: null,
      p_desc: `Impact donation to project #${project_id}`,
    })

    if (trustError) {
      console.error('[POST /api/impact/donate] trust error:', trustError)
      return NextResponse.json({ error: trustError.message }, { status: 500 })
    }

    const treesEquivalent = Math.floor(amount / 10)
    const newBalance = currentBalance - amount

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      trees_equivalent: treesEquivalent,
      amount_donated: amount,
    })
  } catch (err) {
    console.error('[POST /api/impact/donate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
