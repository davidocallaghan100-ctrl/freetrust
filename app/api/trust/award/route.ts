export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/trust/award — admin-only manual trust grant
//
// SECURITY HARDENING (integrity audit 2026-04-15):
// Before this commit the route was callable by any authenticated
// user. With the only dedup being on the literal `reason` string,
// a hostile user could mint up to ₮100 per unique reason and
// drain the trust economy by cycling reasons. The route now
// requires the calling user's profile to have is_admin = true,
// the same gate used by POST /api/trust.
//
// Originally the route did a non-atomic read-insert-check-update
// pattern with the user-session Supabase client, which silently
// failed on the UPDATE step because trust_balances has no UPDATE
// RLS policy. Fixed in the wallet RLS migration; this audit fix
// adds the admin gate on top.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin gate. Same pattern as POST /api/trust — use the admin
    // client so an RLS misconfig on profiles can't accidentally
    // mask the is_admin column.
    const { data: caller, error: callerErr } = await admin
      .from('profiles')
      .select('id, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (callerErr) {
      console.error('[POST /api/trust/award] caller profile lookup failed:', callerErr.message)
      return NextResponse.json({ error: 'Could not verify admin status' }, { status: 500 })
    }

    if (!caller || caller.is_admin !== true) {
      console.warn(
        `[POST /api/trust/award] unauthorized award attempt by user=${user.id} ` +
        `(is_admin=${caller?.is_admin ?? 'null'})`
      )
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    const body = await req.json().catch(() => null) as { amount?: number; reason?: string; targetUserId?: string } | null
    const amount = Number(body?.amount ?? 0)
    const reason = typeof body?.reason === 'string' ? body.reason : 'award'
    // The caller can optionally award to another user. Defaults to
    // the admin's own profile id so the legacy "award yourself for
    // a reason" UI keeps working with the new admin gate.
    const targetUserId = typeof body?.targetUserId === 'string' && body.targetUserId.length > 0
      ? body.targetUserId
      : user.id

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) {
      return NextResponse.json({ error: 'Invalid amount (must be 1–100)' }, { status: 400 })
    }

    // Idempotency check — don't award same reason twice for the same
    // target user. Uses the admin client so the lookup can't be
    // defeated by an RLS misconfig.
    const { data: existing } = await admin
      .from('trust_ledger')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('type', 'award')
      .eq('description', reason)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ awarded: false, reason: 'already_awarded' })
    }

    // Grant via issue_trust RPC — atomic, SECURITY DEFINER, uses
    // the admin client so it runs with service role regardless of
    // RLS state. Same pattern as /api/auth/signup-bonus.
    const { error: rpcError } = await admin.rpc('issue_trust', {
      p_user_id: targetUserId,
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

    // Stamp actor_id on the new ledger row for audit trail
    // visibility — admin grants must be traceable to the admin
    // who initiated them.
    const { error: actorErr } = await admin
      .from('trust_ledger')
      .update({ actor_id: user.id })
      .eq('user_id', targetUserId)
      .eq('type', 'award')
      .eq('description', reason)
      .order('created_at', { ascending: false })
      .limit(1)
    if (actorErr) {
      console.warn('[POST /api/trust/award] actor_id stamp failed:', actorErr.message)
    }

    console.log(
      `[POST /api/trust/award] admin=${user.id} awarded ₮${Math.floor(amount)} → ${targetUserId} ` +
      `(reason="${reason}")`
    )

    return NextResponse.json({ awarded: true, amount, reason, targetUserId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/trust/award] unexpected error:', msg, err)
    return NextResponse.json({ error: `Unexpected error: ${msg}` }, { status: 500 })
  }
}
