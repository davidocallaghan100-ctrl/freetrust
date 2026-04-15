export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/impact/donate — donate trust to a specific impact project
//
// Before the integrity audit this route had three compounding bugs:
//
//   1. NON-ATOMIC TOCTOU. SELECT trust_balances → check >= amount →
//      then call issue_trust(-amount). Two concurrent donate calls
//      could both observe the same balance and both succeed,
//      leaving the user negative and the impact fund over-credited.
//
//   2. SEPARATE NON-TRANSACTIONAL WRITES. The route called issue_trust
//      to debit the user, then a separate UPSERT into impact_donations,
//      then a separate UPDATE on impact_projects.raised. Any of
//      these could fail mid-flight and leave the user debited but
//      the project not credited (or vice versa). There was no
//      compensating action.
//
//   3. USER-SESSION CLIENT FOR LEDGER WRITE. Used the user-session
//      Supabase client for issue_trust which depends on the EXECUTE
//      grant being intact. If the grant gets dropped during a
//      project rebuild, the route silently fails on first call.
//
// Fixed by routing the entire donation through donate_to_impact_fund(),
// a SECURITY DEFINER RPC defined in
// supabase/migrations/20260414000009_trust_economy_audit.sql.
// The RPC handles all five writes (debit user, log ledger entry,
// credit fund pool, log donation, increment project) atomically
// inside a single transaction with FOR UPDATE row locks. The same
// RPC also powers /api/trust/spend's donate_impact action so the
// two paths can never disagree about the global fund balance.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null) as { project_id?: string; amount?: number } | null
    const project_id = body?.project_id
    const amount = Number(body?.amount ?? 0)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (!project_id) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })
    }

    // Atomic donation via the SECURITY DEFINER RPC. The RPC raises
    // `insufficient_funds` (SQLSTATE P0001) on overdraft so we don't
    // need a pre-check — the error path below handles it cleanly.
    const admin = createAdminClient()
    const { data: newFundBalance, error: rpcErr } = await admin.rpc('donate_to_impact_fund', {
      p_user_id:    user.id,
      p_amount:     Math.floor(amount),
      p_project_id: project_id,
      p_desc:       `₮${Math.floor(amount)} donated to impact project`,
    })

    if (rpcErr) {
      const msg = rpcErr.message ?? ''
      if (msg.includes('insufficient_funds')) {
        const { data: bal } = await admin
          .from('trust_balances')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle()
        return NextResponse.json(
          {
            error: 'Insufficient trust balance',
            code:  'insufficient_funds',
            balance: bal?.balance ?? 0,
            required: Math.floor(amount),
          },
          { status: 402 },
        )
      }
      console.error('[POST /api/impact/donate] donate_to_impact_fund RPC failed:', {
        message: rpcErr.message,
        code:    rpcErr.code,
        details: rpcErr.details,
        hint:    rpcErr.hint,
        project_id,
      })
      return NextResponse.json(
        { error: rpcErr.message || 'Could not record donation', code: rpcErr.code ?? null },
        { status: 500 },
      )
    }

    // Re-read the user balance for the response so the UI can show
    // the new total without a /api/wallet round-trip. The donation
    // already landed atomically — this is purely cosmetic.
    const { data: balRow } = await admin
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    // Best-effort notification — non-fatal if it fails.
    admin.from('notifications').insert({
      user_id: user.id,
      type: 'impact',
      title: '🌱 Donation confirmed!',
      body: `₮${Math.floor(amount)} donated to impact. Every ₮10 = 1 tree planted.`,
      link: '/impact',
    }).then(({ error }) => {
      if (error) console.warn('[POST /api/impact/donate] notification insert failed:', error.message)
    })

    return NextResponse.json({
      ok: true,
      new_balance:       balRow?.balance ?? null,
      new_fund_balance:  typeof newFundBalance === 'number' || typeof newFundBalance === 'string'
                           ? Number(newFundBalance)
                           : null,
      trees_equivalent:  Math.floor(amount / 10),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/impact/donate]', msg, err)
    return NextResponse.json({ error: `Internal server error: ${msg}` }, { status: 500 })
  }
}
