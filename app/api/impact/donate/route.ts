export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/impact/donate — donate trust tokens to the Sustainability Fund
//
// Calls the donate_to_impact_fund() RPC defined in
// supabase/migrations/20260415000008_impact_fund_fix.sql which atomically:
//   1. Locks the user's trust_balances row FOR UPDATE
//   2. Validates sufficient funds (raises insufficient_funds otherwise)
//   3. Debits the user's balance
//   4. Writes a 'impact_donation' ledger row
//   5. Bumps impact_fund_balance.balance + lifetime
//   6. Inserts the impact_donations row
//   7. Optionally bumps impact_projects.raised + backers if a project
//      was specified
//
// All in a single transaction, so a partial failure can't leave the
// user with trust deducted but no donation recorded.
//
// Accepts both `projectId` (preferred camelCase) and `project_id`
// (legacy snake_case) so the existing client code keeps working
// during the rollout.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as {
      amount?: unknown
      projectId?: unknown
      project_id?: unknown
    } | null

    const rawAmount = body?.amount
    const amount = typeof rawAmount === 'number' ? Math.floor(rawAmount) : NaN
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive integer' },
        { status: 400 },
      )
    }

    const projectIdRaw = body?.projectId ?? body?.project_id ?? null
    const projectId = typeof projectIdRaw === 'string' && projectIdRaw.length > 0
      ? projectIdRaw
      : null

    // Use the admin client so the RPC is invoked with service-role
    // privileges. The RPC itself is SECURITY DEFINER so this is
    // belt-and-braces — even if the SECURITY DEFINER setting was
    // accidentally dropped, the admin client would still bypass RLS.
    const admin = createAdminClient()
    const { data: rpcData, error: rpcError } = await admin.rpc('donate_to_impact_fund', {
      p_user_id:    user.id,
      p_amount:     amount,
      p_project_id: projectId,
      p_desc:       projectId
        ? `Sustainability Fund donation (project ${projectId})`
        : 'Sustainability Fund donation',
    })

    if (rpcError) {
      // Detect the custom insufficient_funds exception. PostgREST
      // surfaces RAISE EXCEPTION as a PostgrestError with code 'P0001'
      // (SQLSTATE for raised exception) and the message in the
      // `message` field.
      const msg = rpcError.message ?? ''
      if (msg.includes('insufficient_funds')) {
        const { data: bal } = await admin
          .from('trust_balances')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle()
        return NextResponse.json(
          {
            error:    'Insufficient trust balance',
            code:     'insufficient_funds',
            balance:  bal?.balance ?? 0,
            required: amount,
          },
          { status: 402 },
        )
      }
      if (msg.includes('invalid_amount')) {
        return NextResponse.json(
          { error: 'Invalid amount', code: 'invalid_amount' },
          { status: 400 },
        )
      }

      // Any other DB error — surface the real message and code so the
      // next bug report has actionable info instead of a generic 500.
      console.error('[POST /api/impact/donate] donate_to_impact_fund RPC failed:', {
        message: rpcError.message,
        code:    rpcError.code,
        details: rpcError.details,
        hint:    rpcError.hint,
        amount,
        projectId,
      })
      return NextResponse.json(
        {
          error: rpcError.message || 'Could not record donation',
          code:  rpcError.code ?? null,
          hint:  rpcError.hint ?? null,
        },
        { status: 500 },
      )
    }

    // Re-read the fresh fund + user balance so the client gets
    // authoritative values regardless of what the RPC returned.
    // (The RPC also returns these, but a re-read defends against an
    // older RPC version that might not have included them.)
    const result = (rpcData ?? {}) as {
      new_fund_balance?: number
      new_user_balance?: number
      amount_donated?:   number
    }

    const [{ data: fundRow }, { data: userBal }] = await Promise.all([
      admin
        .from('impact_fund_balance')
        .select('balance, lifetime')
        .eq('id', 1)
        .maybeSingle(),
      admin
        .from('trust_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    // Best-effort notification — never fails the donation flow.
    try {
      await admin.from('notifications').insert({
        user_id: user.id,
        type:    'impact',
        title:   '🌱 Donation confirmed!',
        body:    `₮${amount} donated to the Sustainability Fund. Thank you!`,
        link:    '/impact',
      })
    } catch (notifErr) {
      console.warn('[POST /api/impact/donate] notification insert failed:', notifErr)
    }

    return NextResponse.json({
      ok:               true,
      amount_donated:   result.amount_donated   ?? amount,
      new_fund_balance: fundRow?.balance        ?? result.new_fund_balance ?? null,
      fund_lifetime:    fundRow?.lifetime       ?? null,
      new_user_balance: userBal?.balance        ?? result.new_user_balance ?? null,
      project_id:       projectId,
      trees_equivalent: Math.floor(amount / 10),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/impact/donate] unexpected error:', msg, err)
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 },
    )
  }
}
