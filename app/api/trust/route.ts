export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

// POST /api/trust — issue trust tokens (admin only)
//
// CRITICAL SECURITY FIX (integrity audit 2026-04-15):
// Before this commit, the route's only auth check was
// `if (authError || !user)`. ANY authenticated user could call
// it with `{ targetUserId: <anyone>, amount: 1000000, type: 'manual' }`
// and mint unlimited trust to any account, including their own.
// This is a free-money exploit that could let a hostile member
// drain the entire trust economy.
//
// Now requires the calling user's profile to have `is_admin = true`.
// The is_admin column is added by 20260414000009_trust_economy_audit.sql
// and defaults to FALSE for everyone — operators must explicitly
// promote a profile before they can use this endpoint. The promotion
// step is intentionally manual (DB UPDATE) so it can't happen via
// any HTTP path.
//
// Every successful mint is also logged with `actor_id` = the
// admin's profile id so the audit trail can answer "who minted
// this trust?". The actor_id column is added by the same migration.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Admin gate ────────────────────────────────────────────────────────
    // Use the admin client so an RLS misconfiguration on profiles
    // can't accidentally hide the is_admin column from us. Without
    // this lookup, a user-session client could read its own profile
    // row but a missing SELECT policy would make the column come
    // back as undefined → falsy → bypass the gate.
    const { data: caller, error: callerErr } = await admin
      .from('profiles')
      .select('id, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (callerErr) {
      console.error('[POST /api/trust] caller profile lookup failed:', callerErr.message)
      return NextResponse.json(
        { error: 'Could not verify admin status' },
        { status: 500 },
      )
    }

    if (!caller || caller.is_admin !== true) {
      console.warn(
        `[POST /api/trust] unauthorized mint attempt by user=${user.id} ` +
        `(is_admin=${caller?.is_admin ?? 'null'})`
      )
      return NextResponse.json(
        { error: 'Forbidden — admin only' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => null) as {
      targetUserId?: string
      amount?: number
      type?: string
      description?: string
    } | null

    const targetUserId = body?.targetUserId
    const amount = body?.amount
    const type = body?.type
    const description = body?.description

    if (!targetUserId || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Defence-in-depth — even an admin shouldn't be able to mint
    // a million in one call without a deliberate compound action.
    // 100,000 ₮ in a single mint is plenty for any legitimate manual
    // grant (the largest auto-reward in TRUST_REWARDS is 200).
    if (amount > 100_000) {
      return NextResponse.json(
        { error: 'Amount exceeds per-call cap of ₮100,000' },
        { status: 400 },
      )
    }

    // Use the admin client to call the RPC so service-role bypasses
    // any RLS restrictions on trust_balances / trust_ledger.
    const { error: rpcErr } = await admin.rpc('issue_trust', {
      p_user_id: targetUserId,
      p_amount: Math.floor(amount),
      p_type: type ?? 'manual',
      p_ref: null,
      p_desc: description ?? 'Manual admin grant',
    })

    if (rpcErr) {
      console.error('[POST /api/trust] issue_trust RPC failed:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    // Stamp the most recent ledger row with actor_id so the audit
    // trail records WHO issued this mint. issue_trust() doesn't
    // accept actor_id directly (changing the function signature
    // would break every existing caller), so we update the row
    // in a follow-up. Best-effort — a failure here doesn't undo
    // the mint, but does log a warning.
    const { error: actorErr } = await admin
      .from('trust_ledger')
      .update({ actor_id: user.id })
      .eq('user_id', targetUserId)
      .eq('type', type ?? 'manual')
      .order('created_at', { ascending: false })
      .limit(1)

    if (actorErr) {
      console.warn('[POST /api/trust] actor_id stamp failed:', actorErr.message)
    }

    console.log(
      `[POST /api/trust] admin=${user.id} minted ₮${Math.floor(amount)} → ${targetUserId} ` +
      `(type=${type ?? 'manual'})`
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/trust] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
