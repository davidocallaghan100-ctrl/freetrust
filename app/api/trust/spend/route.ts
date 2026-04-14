export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Catalogue of spend actions. Costs are authoritative on the server —
// the client sends the action key and we look up the real cost here
// so a malicious client can't pass `{ action: 'boost_listing', amount: 1 }`
// to get a boost for 1 token instead of 200.
const SPEND_ACTIONS: Record<string, { cost: number; label: string }> = {
  boost_listing:    { cost: 200, label: 'Boost Listing (7 days)'                 },
  offset_fees:      { cost: 100, label: 'Fee offset (₮100 = €1)'                 },
  donate_impact:    { cost: 50,  label: 'Impact Fund donation (₮50 = €0.50)'     },
  unlock_badge:     { cost: 150, label: 'Early Supporter badge unlocked'         },
  featured_profile: { cost: 300, label: 'Featured Profile (3 days)'              },
}

// POST /api/trust/spend — debit trust tokens for a spend action
//
// Previously this route did a non-atomic read-check-write pattern:
//   1. SELECT balance FROM trust_balances ...
//   2. if (balance < cost) return 402
//   3. INSERT into trust_ledger (-cost)
//   4. UPDATE trust_balances SET balance = balance - cost
//
// Three compounding bugs in that approach:
//   a) TOCTOU race between step 1 and step 4 — two concurrent spend
//      calls could both see balance >= cost and both succeed.
//   b) trust_balances had NO UPDATE RLS policy in any versioned
//      migration, so step 4 silently hit 0-rows-updated via PostgREST's
//      classic RLS-blocked-update gotcha. The ledger INSERT (which has
//      a working INSERT policy from 20260413000004_trust_welcome_grant.sql)
//      succeeded, so the user ended up with a negative ledger entry
//      but an unchanged balance — a broken, retryable inconsistent
//      state.
//   c) Neither the ledger INSERT nor the balance UPDATE destructured
//      the { error } field. Both returns were discarded, so any
//      error was silently swallowed. The client saw success + an
//      unchanged balance on the next wallet reload.
//
// Fixed by calling the new `spend_trust()` RPC which:
//   * Locks the trust_balances row FOR UPDATE inside a transaction
//     (atomic — no TOCTOU race)
//   * Raises a custom `insufficient_funds` exception with SQLSTATE
//     P0001 if the balance is less than the requested amount — the
//     caller detects this and returns a clean 402 to the UI
//   * Debits the balance and inserts the ledger entry in the same
//     transaction (all-or-nothing — no partial writes)
//   * Returns the new balance so the caller can echo it back without
//     a round-trip
//   * Is SECURITY DEFINER so it bypasses RLS — no dependency on the
//     UPDATE policy being present (though we added one anyway as
//     belt-and-braces in the same migration)
//
// The RPC is defined in supabase/migrations/20260414000006_wallet_rls.sql
// and uses the same SECURITY DEFINER pattern as the existing
// issue_trust() function that every other trust-awarding code path
// uses successfully.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { action?: string } | null
    const action = body?.action
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const def = SPEND_ACTIONS[action]
    if (!def) {
      return NextResponse.json({ error: `Unknown spend action: ${action}` }, { status: 400 })
    }

    // Use the admin client so the RPC is invoked with service-role
    // privileges. The RPC itself is SECURITY DEFINER so this is
    // belt-and-braces — even if the RPC wasn't SECURITY DEFINER,
    // the admin client would still bypass RLS. Keeps the function
    // reachable on projects where the SECURITY DEFINER setting
    // was accidentally removed.
    const admin = createAdminClient()
    const { data: newBalance, error: rpcError } = await admin.rpc('spend_trust', {
      p_user_id: user.id,
      p_amount:  def.cost,
      p_type:    `spend_${action}`,
      p_desc:    def.label,
    })

    if (rpcError) {
      // Detect the custom `insufficient_funds` exception raised by
      // spend_trust(). PostgREST surfaces RAISE EXCEPTION as a
      // PostgrestError with code 'P0001' (SQLSTATE for raised
      // exception) and the message in the `message` field.
      const msg = rpcError.message ?? ''
      if (msg.includes('insufficient_funds')) {
        // Read the current balance so the UI can show "you have
        // ₮X, need ₮Y more". This is a SELECT, which IS allowed
        // by the existing public-read policy on trust_balances.
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
            required: def.cost,
          },
          { status: 402 },
        )
      }

      // Any other DB error — surface the real message and code so
      // the next bug report has actionable info instead of a
      // generic "Something went wrong".
      console.error('[POST /api/trust/spend] spend_trust RPC failed:', {
        message: rpcError.message,
        code:    rpcError.code,
        details: rpcError.details,
        hint:    rpcError.hint,
        action,
      })
      return NextResponse.json(
        {
          error: rpcError.message || 'Could not debit trust balance',
          code:  rpcError.code ?? null,
          hint:  rpcError.hint ?? null,
        },
        { status: 500 },
      )
    }

    // Success — return the new balance so the client can update
    // without an extra /api/wallet round-trip.
    const resolvedBalance = typeof newBalance === 'number' ? newBalance : null
    return NextResponse.json({
      success: true,
      action,
      cost:  def.cost,
      label: def.label,
      newBalance: resolvedBalance,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/trust/spend] unexpected error:', msg, err)
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 },
    )
  }
}
