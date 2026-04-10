export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/signup-bonus — issue ₮25 welcome bonus (idempotent)
// Idempotency is based on trust_balances existence, NOT trust_ledger,
// because trust_ledger may not exist in the live DB yet.
export async function POST() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if a balance row already exists — if so, bonus was already issued
    const { data: existingBalance } = await supabase
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingBalance) {
      return NextResponse.json({
        issued: false,
        balance: existingBalance.balance ?? 0,
        lifetime: existingBalance.lifetime ?? 0,
        message: 'Signup bonus already issued',
      })
    }

    // Try the RPC first — it handles ledger + balance atomically
    const { error: rpcError } = await supabase.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount: 25,
      p_type: 'signup_bonus',
      p_ref: null,
      p_desc: 'Welcome to FreeTrust! Here are your first ₮25 Trust tokens.',
    })

    if (rpcError) {
      // RPC not available — write directly to trust_balances (source of truth)
      const { error: insertErr } = await supabase
        .from('trust_balances')
        .insert({ user_id: user.id, balance: 25, lifetime: 25 })

      if (insertErr) {
        console.error('[POST /api/auth/signup-bonus] direct insert error:', insertErr)
        return NextResponse.json({ error: 'Could not award bonus', issued: false, balance: 0 }, { status: 500 })
      }

      // Best-effort ledger entry — table may not exist yet, that's OK
      await supabase.from('trust_ledger').insert({
        user_id: user.id,
        amount: 25,
        type: 'signup_bonus',
        description: 'Welcome to FreeTrust! Here are your first ₮25 Trust tokens.',
      })

      return NextResponse.json({ issued: true, balance: 25, lifetime: 25, message: '₮25 Trust awarded!' })
    }

    // RPC succeeded — read the written balance back
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
