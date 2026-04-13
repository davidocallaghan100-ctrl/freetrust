export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/auth/signup-bonus — issue ₮25 welcome bonus (idempotent)
//
// Auth is done via the user-session client (so we know WHICH user is
// requesting the bonus), but every write uses the admin (service-role)
// client so RLS can't silently block the insert the way it did before
// the fix in 20260413000004_trust_welcome_grant.sql.
//
// Three layered attempts:
//   1. RPC issue_trust() — atomic ledger + balance write, SECURITY
//      DEFINER so it bypasses RLS cleanly.
//   2. Direct admin insert into trust_balances + trust_ledger — fallback
//      for the (vanishingly unlikely) case the RPC is missing.
//   3. Explicit 500 with a detail field so the client sees SOMETHING
//      instead of the old silent-failure behaviour.
//
// Idempotency is based on whether a trust_balances row already exists for
// the user — the register page and /auth/callback both hit this route
// and we can't double-grant.
export async function POST() {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Writes bypass RLS — the user-session client would hit the same
    // INSERT RLS failures that caused the original zero-coin bug.
    const admin = createAdminClient()

    // Idempotency check: if a balance row already exists, the bonus has
    // already been granted. Return the current balance so the caller can
    // still update its UI (but with issued=false so we don't show the
    // "₮25 awarded!" toast twice).
    const { data: existingBalance, error: checkError } = await admin
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    if (checkError) {
      console.error('[POST /api/auth/signup-bonus] idempotency check error:', checkError)
      // Don't fail outright — the check is best-effort, we'd rather try
      // the grant and let the RPC's upsert handle double-spend safety.
    }

    if (existingBalance) {
      return NextResponse.json({
        issued: false,
        balance: existingBalance.balance ?? 0,
        lifetime: existingBalance.lifetime ?? 0,
        message: 'Signup bonus already issued',
      })
    }

    // ── Attempt 1: RPC ──────────────────────────────────────────────────────
    // issue_trust() is SECURITY DEFINER so it runs with the function
    // owner's privileges and writes to both trust_ledger and
    // trust_balances atomically. Defined in
    // supabase/migrations/20260413000004_trust_welcome_grant.sql.
    const { error: rpcError } = await admin.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount: 25,
      p_type: 'signup_bonus',
      p_ref: null,
      p_desc: 'Welcome to FreeTrust! Here are your first ₮25 Trust tokens.',
    })

    if (!rpcError) {
      // RPC succeeded — read the written balance back so the UI toast
      // can show the final number.
      const { data: balanceData } = await admin
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
    }

    // RPC failed — log the full error so future investigations don't
    // face the "silently swallowed" problem we just fixed.
    console.error('[POST /api/auth/signup-bonus] issue_trust RPC failed, trying direct insert:', {
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
    })

    // ── Attempt 2: direct admin insert ──────────────────────────────────────
    // Same shape the RPC would have written. The admin client bypasses
    // RLS so this works even if the user-level INSERT policy is missing.
    const { error: balanceInsertErr } = await admin
      .from('trust_balances')
      .insert({ user_id: user.id, balance: 25, lifetime: 25 })

    if (balanceInsertErr) {
      console.error('[POST /api/auth/signup-bonus] direct balance insert error:', {
        code: balanceInsertErr.code,
        message: balanceInsertErr.message,
        details: balanceInsertErr.details,
        hint: balanceInsertErr.hint,
      })
      return NextResponse.json(
        {
          error: 'Could not award bonus',
          issued: false,
          balance: 0,
          detail: {
            code: balanceInsertErr.code ?? null,
            message: balanceInsertErr.message ?? null,
            hint: balanceInsertErr.hint ?? null,
          },
        },
        { status: 500 }
      )
    }

    // Best-effort ledger entry — atomicity is weaker here than in the
    // RPC path but the balance (the source of truth the UI reads) is
    // already correct, so a ledger failure is non-fatal. Log it but
    // don't fail the response.
    const { error: ledgerErr } = await admin.from('trust_ledger').insert({
      user_id: user.id,
      amount: 25,
      type: 'signup_bonus',
      description: 'Welcome to FreeTrust! Here are your first ₮25 Trust tokens.',
    })
    if (ledgerErr) {
      console.error('[POST /api/auth/signup-bonus] ledger insert error (non-fatal):', ledgerErr.message)
    }

    return NextResponse.json({
      issued: true,
      balance: 25,
      lifetime: 25,
      message: '₮25 Trust awarded!',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[POST /api/auth/signup-bonus] Unexpected error:', message, stack)
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 })
  }
}
