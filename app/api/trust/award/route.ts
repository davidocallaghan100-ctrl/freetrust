export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/trust/award — award trust for a specific reason (idempotent by reason)
//
// Previously this route did a non-atomic read-insert-check-update
// pattern with the user-session Supabase client, which silently
// failed on the UPDATE step because trust_balances has no UPDATE
// RLS policy (see the detailed commentary in /api/trust/spend/
// route.ts for the full bug history). The ledger INSERT succeeded,
// the balance UPDATE silently did nothing, and the user's balance
// never changed.
//
// Fixed by using the issue_trust() SECURITY DEFINER RPC — the same
// atomic pattern every other trust-awarding code path uses
// successfully (auth/callback, signup-bonus, wallet/transfer,
// webhooks/stripe, articles, jobs/apply, events, orders, etc.).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { amount?: number; reason?: string } | null
    const amount = Number(body?.amount ?? 0)
    const reason = typeof body?.reason === 'string' ? body.reason : 'award'

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) {
      return NextResponse.json({ error: 'Invalid amount (must be 1–100)' }, { status: 400 })
    }

    // Idempotency check — don't award same reason twice. Uses the
    // user-session client so RLS scopes the query to this user's
    // own ledger entries (which has a SELECT policy per
    // 20260413000004_trust_welcome_grant.sql).
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

    // Grant via issue_trust RPC — atomic, SECURITY DEFINER, uses
    // the admin client so it runs with service role regardless of
    // RLS state. Same pattern as /api/auth/signup-bonus.
    const admin = createAdminClient()
    const { error: rpcError } = await admin.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount:  Math.floor(amount),
      p_type:    'award',
      p_ref:     null,
      p_desc:    reason,
    })

    if (rpcError) {
      console.error('[POST /api/trust/award] issue_trust RPC failed:', {
        message: rpcError.message,
        code:    rpcError.code,
        details: rpcError.details,
        hint:    rpcError.hint,
      })
      return NextResponse.json(
        { error: rpcError.message || 'Could not award trust' },
        { status: 500 },
      )
    }

    return NextResponse.json({ awarded: true, amount, reason })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/trust/award] unexpected error:', msg, err)
    return NextResponse.json({ error: `Unexpected error: ${msg}` }, { status: 500 })
  }
}
