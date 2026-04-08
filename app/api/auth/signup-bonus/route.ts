import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/signup-bonus — issue ₮25 welcome bonus (idempotent)
export async function POST() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if already issued (idempotent)
    const { data: existing } = await supabase
      .from('trust_ledger')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'signup_bonus')
      .maybeSingle()

    if (existing) {
      // Already issued — return current balance
      const { data: balanceData } = await supabase
        .from('trust_balances')
        .select('balance, lifetime')
        .eq('user_id', user.id)
        .maybeSingle()

      return NextResponse.json({
        issued: false,
        balance: balanceData?.balance ?? 0,
        lifetime: balanceData?.lifetime ?? 0,
        message: 'Signup bonus already issued',
      })
    }

    // Issue the bonus
    const { error: rpcError } = await supabase.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount: 25,
      p_type: 'signup_bonus',
      p_ref: null,
      p_desc: 'Welcome to FreeTrust! Here are your first ₮25 Trust tokens.',
    })

    if (rpcError) {
      console.error('[POST /api/auth/signup-bonus] RPC error:', rpcError)
      // Gracefully degrade — don't fail signup if trust system isn't set up yet
      return NextResponse.json({ issued: false, balance: 0, lifetime: 0, message: 'Trust system not yet configured' })
    }

    // Get updated balance
    const { data: balanceData } = await supabase
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      issued: true,
      balance: balanceData?.balance ?? 25,
      lifetime: balanceData?.lifetime ?? 25,
      message: '₮25 Trust awarded!',
    })
  } catch (err) {
    console.error('[POST /api/auth/signup-bonus] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
