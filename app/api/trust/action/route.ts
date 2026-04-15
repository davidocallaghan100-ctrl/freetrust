export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Qualifying actions and their Trust rewards.
//
// `cooldown_seconds` enforces a per-user, per-action throttle on
// repeatable actions. Without this the route was a free-mint
// surface — a bot could call /api/trust/action with
// action=daily_login as fast as it could open sockets and earn
// unlimited trust. The 24h daily_login cooldown matches the
// product spec ("once per day"); the others are loose enough
// that legitimate users will never hit them but tight enough
// that scripted abuse is uneconomic.
//
// Non-repeatable actions don't need cooldowns because the
// idempotency check below blocks them after the first success.
//
// `client_callable: false` means the action exists in the catalogue
// (so the GET handler can render it in "Earn More Trust") but
// CANNOT be triggered by a client POST. Server-side handlers
// (auth callback, signup-bonus route, etc.) are the only valid
// callers. Before this fix, any client could POST signup_bonus
// and mint ₮25 — twice if the auth callback hadn't run yet.
const TRUST_ACTIONS: Record<string, {
  amount: number
  label: string
  repeatable?: boolean
  cooldown_seconds?: number
  client_callable?: boolean
}> = {
  // SIGNUP_BONUS is authoritatively 200 per lib/trust/rewards.ts.
  // Hardcoded value kept as a fallback so this catalogue is readable
  // without an import, but the signup path itself uses the constant
  // directly in /api/auth/signup-bonus/route.ts.
  signup_bonus:      { amount: 200, label: 'Welcome bonus',                 client_callable: false },
  complete_profile:  { amount: 10,  label: 'Profile completed to 100%' },
  first_sale:        { amount: 50,  label: 'First completed transaction' },
  receive_review:    { amount: 15,  label: 'Received a review',  repeatable: true, client_callable: false },
  refer_member:      { amount: 100, label: 'Referred a new member', repeatable: true, client_callable: false },
  post_article:      { amount: 20,  label: 'Published an article', repeatable: true, client_callable: false },
  host_event:        { amount: 15,  label: 'Hosted an event',      repeatable: true, client_callable: false },
  join_community:    { amount: 5,   label: 'Joined a community' },
  get_10_followers:  { amount: 20,  label: 'Reached 10 followers' },
  get_50_followers:  { amount: 30,  label: 'Reached 50 followers' },
  get_100_followers: { amount: 50,  label: 'Reached 100 followers' },
  make_purchase:     { amount: 5,   label: 'Made a purchase',      repeatable: true, client_callable: false },
  leave_review:      { amount: 10,  label: 'Left a review',        repeatable: true, client_callable: false },
  daily_login:       { amount: 1,   label: 'Daily check-in',       repeatable: true, cooldown_seconds: 23 * 60 * 60 },
}

// POST /api/trust/action — award trust for a qualifying action
//
// Previously did a non-atomic idempotency-check → insert-ledger →
// read-balance → update-balance pattern that silently failed on the
// final UPDATE because trust_balances has no UPDATE RLS policy.
// See /api/trust/spend/route.ts for the full bug history and the
// companion fix in 20260414000006_wallet_rls.sql.
//
// Fixed to use the issue_trust() SECURITY DEFINER RPC with the
// admin client — same pattern as wallet/transfer, auth/callback,
// signup-bonus, etc.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { action?: string; ref?: string } | null
    const action = body?.action
    const ref = body?.ref

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const actionDef = TRUST_ACTIONS[action]
    if (!actionDef) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const { amount, label, repeatable, cooldown_seconds, client_callable } = actionDef

    // Reject client-initiated calls for actions that should only fire
    // from server-side handlers (signup_bonus, receive_review, etc.).
    // Without this gate, any client could POST signup_bonus once via
    // the auth callback path AND once via /api/trust/action and double
    // their welcome bonus.
    if (client_callable === false) {
      console.warn(`[POST /api/trust/action] blocked client-initiated action=${action} user=${user.id}`)
      return NextResponse.json(
        { awarded: false, reason: 'server_only_action' },
        { status: 403 },
      )
    }

    const admin = createAdminClient()

    // Idempotency check for non-repeatable actions — use limit(1)
    // instead of maybeSingle() so a stray duplicate row in the ledger
    // doesn't blow up the route with a "JSON object requested,
    // multiple rows returned" error. Uses the admin client so it
    // can't be defeated by an RLS misconfiguration on trust_ledger.
    if (!repeatable) {
      const { data: existing } = await admin
        .from('trust_ledger')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', action)
        .limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json({ awarded: false, reason: 'already_awarded', action })
      }
    }

    // Rate limit repeatable actions via trust_action_log. The table
    // is added by 20260414000009_trust_economy_audit.sql. The check
    // is a simple "is the last_at older than cooldown_seconds?".
    // No cooldown configured = no rate limit (legacy behaviour).
    if (repeatable && typeof cooldown_seconds === 'number') {
      const { data: lastLog } = await admin
        .from('trust_action_log')
        .select('last_at')
        .eq('user_id', user.id)
        .eq('action', action)
        .maybeSingle()
      if (lastLog?.last_at) {
        const lastMs = new Date(lastLog.last_at).getTime()
        const elapsed = (Date.now() - lastMs) / 1000
        if (elapsed < cooldown_seconds) {
          const wait = Math.ceil(cooldown_seconds - elapsed)
          return NextResponse.json(
            { awarded: false, reason: 'cooldown', wait_seconds: wait },
            { status: 429 },
          )
        }
      }
    }

    // Atomic award via the SECURITY DEFINER RPC — bypasses the
    // trust_balances UPDATE policy problem entirely.
    const { error: rpcError } = await admin.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount:  amount,
      p_type:    action,
      p_ref:     ref ?? null,
      p_desc:    label,
    })

    if (rpcError) {
      console.error('[POST /api/trust/action] issue_trust RPC failed:', {
        message: rpcError.message,
        code:    rpcError.code,
        details: rpcError.details,
        hint:    rpcError.hint,
        action,
      })
      return NextResponse.json(
        { error: rpcError.message || 'Could not award trust' },
        { status: 500 },
      )
    }

    // Stamp the rate-limiter row so the next call within the
    // cooldown window is rejected. Use UPSERT so the first call
    // creates the row and subsequent calls just update last_at.
    // count is incremented for diagnostics — operator can grep
    // the log for high-count rows to spot abuse.
    if (repeatable && typeof cooldown_seconds === 'number') {
      // last_at is the only field the rate limiter actually reads,
      // so the upsert just touches it. The `count` column on
      // trust_action_log is for ad-hoc abuse diagnostics — to
      // increment it atomically would need a Postgres function;
      // for now the column stays at its DEFAULT 0 which is fine
      // because the rate limiter only consults last_at.
      const { error: logErr } = await admin
        .from('trust_action_log')
        .upsert(
          {
            user_id: user.id,
            action,
            last_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,action' }
        )
      if (logErr) {
        console.warn('[POST /api/trust/action] rate-limiter log upsert failed:', logErr.message)
      }
    }

    // Read the new balance to echo back to the client so the UI can
    // update without a separate /api/wallet round-trip. This is a
    // SELECT which is allowed by the public-read RLS policy on
    // trust_balances (added by 20260411_trust_balances_public_read.sql).
    const { data: newBal } = await admin
      .from('trust_balances')
      .select('balance, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      awarded: true,
      amount,
      action,
      label,
      newBalance:  newBal?.balance  ?? amount,
      newLifetime: newBal?.lifetime ?? amount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/trust/action] unexpected error:', msg, err)
    return NextResponse.json({ error: `Unexpected error: ${msg}` }, { status: 500 })
  }
}

// GET /api/trust/action — list available actions and which ones this user has completed
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: completed } = await supabase
      .from('trust_ledger')
      .select('type')
      .eq('user_id', user.id)

    const completedTypes = new Set((completed ?? []).map((e: { type: string }) => e.type))

    const actions = Object.entries(TRUST_ACTIONS).map(([key, def]) => ({
      key,
      amount: def.amount,
      label: def.label,
      repeatable: def.repeatable ?? false,
      done: !def.repeatable && completedTypes.has(key),
    }))

    return NextResponse.json({ actions })
  } catch (err) {
    console.error('[GET /api/trust/action]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
