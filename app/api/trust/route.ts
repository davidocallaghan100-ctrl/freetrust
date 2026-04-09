export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/trust — get current user's trust balance and recent ledger
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [balanceResult, ledgerResult] = await Promise.all([
      supabase
        .from('trust_balances')
        .select('balance, lifetime, updated_at')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('trust_ledger')
        .select('amount, type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    return NextResponse.json({
      balance: balanceResult.data?.balance ?? 0,
      lifetime: balanceResult.data?.lifetime ?? 0,
      lastUpdated: balanceResult.data?.updated_at ?? null,
      recentActivity: ledgerResult.data ?? [],
    })
  } catch (err) {
    console.error('[GET /api/trust] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/trust/issue — issue trust tokens (admin / server action only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { targetUserId, amount, type, description } = body

    if (!targetUserId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const { error } = await supabase.rpc('issue_trust', {
      p_user_id: targetUserId,
      p_amount: Math.floor(amount),
      p_type: type ?? 'manual',
      p_ref: null,
      p_desc: description ?? 'Trust issued',
    })

    if (error) {
      console.error('[POST /api/trust]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/trust] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
