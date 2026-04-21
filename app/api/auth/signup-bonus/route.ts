export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'
import { sendEmail } from '@/lib/email/send'
import { insertNotification } from '@/lib/notifications/insert'

// POST /api/auth/signup-bonus — issue the welcome bonus (idempotent)
//
// The amount is read from TRUST_REWARDS.SIGNUP_BONUS (currently ₮200).
// This file previously hardcoded `25` in ~10 places, which meant new
// members received ₮25 even though the catalogue said ₮200. That bug
// is fixed here — every amount is read from the single source of
// truth in lib/trust/rewards.ts.
//
// Three idempotency / correction cases:
//
//   CASE A — user already has a trust_balances row AND their signup
//            grant total is >= TRUST_REWARDS.SIGNUP_BONUS. The bonus
//            has already been fully issued. Return issued=false with
//            the current balance.
//
//   CASE B — user has a trust_balances row but their signup grant
//            total is < TRUST_REWARDS.SIGNUP_BONUS. They received the
//            old ₮25 bonus (or partial amount). Issue a top-up for
//            the difference via a 'signup_bonus_topup' ledger type
//            so the audit trail shows what happened, and return
//            issued=true with the corrected balance.
//
//   CASE C — user has no trust_balances row (first signup). Issue
//            the full TRUST_REWARDS.SIGNUP_BONUS amount and return
//            issued=true.
//
// In every success path the response includes `amount` so the frontend
// toast can render the correct number instead of a hardcoded string.
// Every write uses the admin (service-role) client so RLS can't block
// the insert. Every failure path logs the full Supabase error object.
export async function POST() {
  const expectedAmount = TRUST_REWARDS.SIGNUP_BONUS
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Look up the current balance + sum of all signup_bonus AND
    // signup_bonus_topup ledger rows so we know whether the user is
    // in Case A, B or C.
    const [balanceRes, grantsRes] = await Promise.all([
      admin
        .from('trust_balances')
        .select('balance, lifetime')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('trust_ledger')
        .select('amount')
        .eq('user_id', user.id)
        .in('type', [
          TRUST_LEDGER_TYPES.SIGNUP_BONUS,
          'signup_bonus_topup',
        ]),
    ])

    const existingBalance = balanceRes.data
    const grantTotal = (grantsRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    )

    // ── CASE A: already fully granted ──────────────────────────────────
    if (existingBalance && grantTotal >= expectedAmount) {
      return NextResponse.json({
        issued:         false,
        amount:         expectedAmount,
        balance:        existingBalance.balance  ?? 0,
        lifetime:       existingBalance.lifetime ?? 0,
        already_issued: true,
        message:        'Signup bonus already issued',
      })
    }

    // ── CASE B: partial grant — issue the top-up ──────────────────────
    if (existingBalance && grantTotal > 0 && grantTotal < expectedAmount) {
      const topUp = expectedAmount - grantTotal
      const { error: topupErr } = await admin.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount:  topUp,
        p_type:    'signup_bonus_topup',
        p_ref:     null,
        p_desc:    `Signup bonus top-up — corrected from ₮${grantTotal} to ₮${expectedAmount}`,
      })
      if (topupErr) {
        console.error('[signup-bonus] top-up RPC failed:', {
          code:    topupErr.code,
          message: topupErr.message,
          details: topupErr.details,
          hint:    topupErr.hint,
        })
        return NextResponse.json(
          {
            error:  'Could not apply signup bonus top-up',
            detail: {
              code:    topupErr.code    ?? null,
              message: topupErr.message ?? null,
              hint:    topupErr.hint    ?? null,
            },
          },
          { status: 500 },
        )
      }
      const { data: newBal } = await admin
        .from('trust_balances')
        .select('balance, lifetime')
        .eq('user_id', user.id)
        .maybeSingle()
      console.log(
        `[signup-bonus] topped up user ${user.id}: +₮${topUp} ` +
        `(was ₮${grantTotal}, now ₮${expectedAmount})`,
      )
      return NextResponse.json({
        issued:   true,
        amount:   expectedAmount,
        topup:    topUp,
        balance:  newBal?.balance  ?? expectedAmount,
        lifetime: newBal?.lifetime ?? expectedAmount,
        message:  `Welcome to FreeTrust! You've received ₮${expectedAmount} to get started (corrected from ₮${grantTotal})`,
      })
    }

    // ── CASE C: first-time grant ──────────────────────────────────────
    const description = `Welcome to FreeTrust! Here are your first ₮${expectedAmount} Trust tokens.`
    const { error: rpcError } = await admin.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount:  expectedAmount,
      p_type:    TRUST_LEDGER_TYPES.SIGNUP_BONUS,
      p_ref:     null,
      p_desc:    description,
    })

    if (!rpcError) {
      // Verify the ledger entry was actually written with the correct
      // amount. If it isn't, log a loud warning — the next bug report
      // can grep Vercel logs for '[signup-bonus] AMOUNT MISMATCH' and
      // immediately know what happened.
      const [{ data: ledgerCheck }, { data: balanceData }] = await Promise.all([
        admin
          .from('trust_ledger')
          .select('amount')
          .eq('user_id', user.id)
          .eq('type', TRUST_LEDGER_TYPES.SIGNUP_BONUS)
          .limit(1),
        admin
          .from('trust_balances')
          .select('balance, lifetime')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])
      const ledgerAmount = Number(ledgerCheck?.[0]?.amount ?? 0)
      if (ledgerAmount !== expectedAmount) {
        console.error(
          `[signup-bonus] AMOUNT MISMATCH for user ${user.id}: ` +
          `ledger has ₮${ledgerAmount}, expected ₮${expectedAmount}`,
        )
      }

      // Fire the welcome email (non-blocking). sendEmail swallows
      // its own errors so a Resend outage can't crash the signup
      // flow — the bonus has already been credited, email is a
      // nice-to-have on top. Only fires on the first-time-grant
      // path (CASE C) so users don't get a fresh "Welcome!" email
      // every time they revisit the site.
      void sendEmail({
        type:    'welcome',
        userId:  user.id,
        payload: { amount: expectedAmount },
      }).catch(err => {
        console.error('[signup-bonus] welcome email dispatch threw:', err)
      })

      // Fire-and-forget — don't block the signup response on notification insert
      void insertNotification({
        userId: user.id,
        type: 'welcome',
        title: 'Welcome to FreeTrust! 🎉',
        body: `₮${expectedAmount} TrustCoins added to your wallet. Explore the marketplace to start earning more.`,
        link: '/wallet',
      }).catch(e => console.error('[signup-bonus] welcome notification failed:', e))

      return NextResponse.json({
        issued:   true,
        amount:   expectedAmount,
        balance:  balanceData?.balance  ?? expectedAmount,
        lifetime: balanceData?.lifetime ?? expectedAmount,
        message:  `Welcome to FreeTrust! You've received ₮${expectedAmount} to get started`,
      })
    }

    // RPC failed — log and fall back to a direct admin insert.
    console.error('[signup-bonus] issue_trust RPC failed, trying direct insert:', {
      code:    rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint:    rpcError.hint,
    })

    const { error: balanceInsertErr } = await admin
      .from('trust_balances')
      .insert({
        user_id:  user.id,
        balance:  expectedAmount,
        lifetime: expectedAmount,
      })

    if (balanceInsertErr) {
      console.error('[signup-bonus] direct balance insert error:', {
        code:    balanceInsertErr.code,
        message: balanceInsertErr.message,
        details: balanceInsertErr.details,
        hint:    balanceInsertErr.hint,
      })
      return NextResponse.json(
        {
          error:   'Could not award bonus',
          issued:  false,
          balance: 0,
          amount:  expectedAmount,
          detail: {
            code:    balanceInsertErr.code    ?? null,
            message: balanceInsertErr.message ?? null,
            hint:    balanceInsertErr.hint    ?? null,
          },
        },
        { status: 500 },
      )
    }

    const { error: ledgerErr } = await admin.from('trust_ledger').insert({
      user_id:     user.id,
      amount:      expectedAmount,
      type:        TRUST_LEDGER_TYPES.SIGNUP_BONUS,
      description,
    })
    if (ledgerErr) {
      console.error('[signup-bonus] ledger insert error (non-fatal):', ledgerErr.message)
    }

    return NextResponse.json({
      issued:   true,
      amount:   expectedAmount,
      balance:  expectedAmount,
      lifetime: expectedAmount,
      message:  `Welcome to FreeTrust! You've received ₮${expectedAmount} to get started`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[signup-bonus] Unexpected error:', message, stack)
    return NextResponse.json(
      { error: `Internal server error: ${message}`, amount: expectedAmount },
      { status: 500 },
    )
  }
}
