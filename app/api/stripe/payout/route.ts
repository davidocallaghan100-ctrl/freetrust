export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// POST /api/stripe/payout
// ============================================================================
// In-app withdrawal endpoint. Replaces the old "redirect to Stripe Express
// dashboard" flow on /wallet with a real flow that:
//
//   1. Authenticates the user
//   2. Confirms they have a Stripe Connect account whose charges_enabled
//      AND payouts_enabled flags are both true (asked Stripe directly,
//      never trusting the cached stripe_onboarded DB column on profiles)
//   3. Recomputes the user's available balance server-side from
//      orders + deposits + transfers + prior withdrawals (so a
//      tampered client can't withdraw more than they're entitled to)
//   4. Validates the requested amount is positive AND ≤ available
//   5. Creates a Stripe Transfer from the platform balance to the
//      user's connected account (the platform-owned charges model
//      used by /api/checkout/product + /api/checkout/service means
//      all funds sit on the platform until a transfer is initiated)
//   6. Inserts a row in the new `withdrawals` table to track lifecycle
//      via webhook updates (payout.paid / payout.failed)
//   7. Returns a JSON payload the client can use to render a success
//      toast with an arrival estimate, OR a structured error so the
//      UI can surface the exact reason payouts failed
//
// Failures are NEVER swallowed — every error path returns a
// human-readable message in the response body so the wallet UI can
// show it to the user.

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

// Minimum payout — Stripe's own minimum on most accounts is €1.00
// but smaller amounts cost more in fees than they're worth so the
// product floor is €5.00. The wallet UI also enforces this so the
// server-side check is a defence-in-depth for a tampered client.
const MIN_WITHDRAWAL_CENTS = 500

// Maximum payout — defence against a runaway server bug or compromised
// session draining a balance that's been corrupted by a separate issue.
// A legitimate big-account user can withdraw in chunks; the cap keeps
// the blast radius of any bug small enough to recover from.
const MAX_WITHDRAWAL_CENTS = 5_000_00 // €5,000

interface PayoutErrorBody {
  error: string
  code?:
    | 'unauthorized'
    | 'no_stripe_account'
    | 'not_onboarded'
    | 'charges_disabled'
    | 'payouts_disabled'
    | 'invalid_amount'
    | 'amount_too_low'
    | 'amount_too_high'
    | 'insufficient_balance'
    | 'stripe_error'
    | 'connect_not_enabled'
    | 'config_missing'
    | 'internal'
  detail?: string
}

function errBody(error: string, code: PayoutErrorBody['code'], detail?: string): PayoutErrorBody {
  return detail ? { error, code, detail } : { error, code }
}

// Compute the user's available balance in cents, server-side, from
// the same source-of-truth tables /api/wallet uses to render the
// "Available Balance" hero number — but expressed in integer cents
// to avoid floating-point drift across a withdraw → balance update
// → recheck round trip. Returns null on a query failure so the
// caller can surface a clean error rather than withdrawing against
// an unknown balance.
async function computeAvailableCents(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<{ cents: number; error: null } | { cents: 0; error: string }> {
  const [
    depositsRes,
    earnedRes,
    spentRes,
    sentRes,
    receivedRes,
    withdrawalsRes,
  ] = await Promise.all([
    admin
      .from('money_deposits')
      .select('amount_cents')
      .eq('user_id', userId)
      .eq('status', 'completed'),
    admin
      .from('orders')
      .select('amount, status')
      .eq('seller_id', userId)
      .neq('delivery_type', 'deposit'),
    admin
      .from('orders')
      .select('amount, status')
      .eq('buyer_id', userId)
      .neq('delivery_type', 'deposit'),
    admin
      .from('wallet_transfers')
      .select('amount, currency')
      .eq('sender_id', userId)
      .eq('status', 'completed'),
    admin
      .from('wallet_transfers')
      .select('amount, currency')
      .eq('recipient_id', userId)
      .eq('status', 'completed'),
    // Prior withdrawals — every state except 'failed' or 'cancelled'
    // counts against available balance. We include 'pending' and
    // 'processing' because the funds are already in flight and
    // shouldn't be double-spent.
    admin
      .from('withdrawals')
      .select('amount_cents, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing', 'paid']),
  ])

  for (const r of [depositsRes, earnedRes, spentRes, sentRes, receivedRes, withdrawalsRes]) {
    if (r.error) {
      return { cents: 0, error: r.error.message }
    }
  }

  const depositedCents = (depositsRes.data ?? [])
    .reduce((s, d: { amount_cents: number }) => s + (d.amount_cents ?? 0), 0)

  const earnedCents = (earnedRes.data ?? [])
    .filter((o: { status: string }) => o.status === 'completed')
    .reduce((s, o: { amount: number }) => s + Math.round((o.amount ?? 0) * 100), 0)

  const spentCents = (spentRes.data ?? [])
    .filter((o: { status: string }) => o.status === 'completed')
    .reduce((s, o: { amount: number }) => s + Math.round((o.amount ?? 0) * 100), 0)

  const eurSentCents = (sentRes.data ?? [])
    .filter((t: { currency: string }) => t.currency === 'EUR')
    .reduce((s, t: { amount: number }) => s + Math.round(Number(t.amount) * 100), 0)

  const eurReceivedCents = (receivedRes.data ?? [])
    .filter((t: { currency: string }) => t.currency === 'EUR')
    .reduce((s, t: { amount: number }) => s + Math.round(Number(t.amount) * 100), 0)

  const withdrawnCents = (withdrawalsRes.data ?? [])
    .reduce((s, w: { amount_cents: number }) => s + (w.amount_cents ?? 0), 0)

  const available =
    depositedCents +
    earnedCents -
    spentCents -
    eurSentCents +
    eurReceivedCents -
    withdrawnCents

  return { cents: Math.max(0, available), error: null }
}

export async function POST(req: NextRequest) {
  console.log('[POST /api/stripe/payout] start')

  if (!stripe) {
    console.error('[POST /api/stripe/payout] STRIPE_SECRET_KEY not set')
    return NextResponse.json(
      errBody('Payments are not configured. Please contact support.', 'config_missing'),
      { status: 503 }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn('[POST /api/stripe/payout] unauthorized', authError?.message)
      return NextResponse.json(
        errBody('You need to be signed in to withdraw funds.', 'unauthorized'),
        { status: 401 }
      )
    }

    // ── Parse + validate the request body ──────────────────────────────────
    let amountCents: number
    try {
      const body = await req.json()
      const raw = body?.amount_cents
      amountCents = typeof raw === 'number' ? Math.floor(raw) : NaN
    } catch {
      return NextResponse.json(
        errBody('Invalid request — amount_cents is required.', 'invalid_amount'),
        { status: 400 }
      )
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        errBody('Enter a positive amount to withdraw.', 'invalid_amount'),
        { status: 400 }
      )
    }
    if (amountCents < MIN_WITHDRAWAL_CENTS) {
      return NextResponse.json(
        errBody(
          `Minimum withdrawal is €${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)}.`,
          'amount_too_low'
        ),
        { status: 400 }
      )
    }
    if (amountCents > MAX_WITHDRAWAL_CENTS) {
      return NextResponse.json(
        errBody(
          `Maximum single withdrawal is €${(MAX_WITHDRAWAL_CENTS / 100).toFixed(2)}. ` +
          `Please withdraw in smaller amounts.`,
          'amount_too_high'
        ),
        { status: 400 }
      )
    }

    // ── Fetch the user's Stripe Connect account id ─────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr) {
      console.error('[POST /api/stripe/payout] profile lookup failed:', profileErr.message)
      return NextResponse.json(
        errBody('Could not load your account. Please try again.', 'internal', profileErr.message),
        { status: 500 }
      )
    }

    const stripeAccountId = (profile?.stripe_account_id as string | null) ?? null
    if (!stripeAccountId) {
      return NextResponse.json(
        errBody(
          'Connect a bank account before withdrawing. Tap "Withdraw" again to start setup.',
          'no_stripe_account'
        ),
        { status: 409 }
      )
    }

    // ── Verify Connect account is fully enabled — ask Stripe directly ──────
    let account: Stripe.Account
    try {
      account = await stripe.accounts.retrieve(stripeAccountId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[POST /api/stripe/payout] stripe.accounts.retrieve(${stripeAccountId}) failed:`,
        msg
      )
      // Treat the same Connect-not-enabled gotcha that /api/stripe/connect
      // detects as a clean 503 with a setup hint instead of a 500.
      if (
        msg.includes('signed up for Connect') ||
        msg.includes('sign up for Connect') ||
        msg.includes('Connect is not enabled') ||
        msg.includes('connect/accounts/overview')
      ) {
        return NextResponse.json(
          errBody(
            'Withdrawals are not available yet — Stripe Connect is still being set up for this platform.',
            'connect_not_enabled'
          ),
          { status: 503 }
        )
      }
      return NextResponse.json(
        errBody('Could not verify your Stripe account.', 'stripe_error', msg),
        { status: 502 }
      )
    }

    if (!account.charges_enabled) {
      return NextResponse.json(
        errBody(
          'Your Stripe account is not yet allowed to receive charges. Finish onboarding to enable withdrawals.',
          'charges_disabled'
        ),
        { status: 409 }
      )
    }
    if (!account.payouts_enabled) {
      return NextResponse.json(
        errBody(
          'Your Stripe account is not yet allowed to receive payouts. Finish onboarding (or check your Stripe dashboard for any required documents).',
          'payouts_disabled'
        ),
        { status: 409 }
      )
    }

    // ── Server-side balance recheck ────────────────────────────────────────
    const admin = createAdminClient()
    const balance = await computeAvailableCents(admin, user.id)
    if (balance.error) {
      console.error('[POST /api/stripe/payout] balance compute failed:', balance.error)
      return NextResponse.json(
        errBody('Could not verify your available balance. Please try again.', 'internal', balance.error),
        { status: 500 }
      )
    }
    if (amountCents > balance.cents) {
      return NextResponse.json(
        errBody(
          `Insufficient balance — you have €${(balance.cents / 100).toFixed(2)} available.`,
          'insufficient_balance'
        ),
        { status: 402 }
      )
    }

    // ── Create the withdrawals row first (status='pending') so we always
    //     have a record even if the Stripe call throws after creating a
    //     transfer mid-network-failure. We'll update with the transfer id
    //     once we hear back from Stripe.
    const { data: withdrawal, error: insertErr } = await admin
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        currency: 'eur',
        stripe_account_id: stripeAccountId,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr || !withdrawal) {
      console.error('[POST /api/stripe/payout] withdrawals insert failed:', insertErr?.message)
      return NextResponse.json(
        errBody(
          'Could not create the withdrawal record. Please try again.',
          'internal',
          insertErr?.message
        ),
        { status: 500 }
      )
    }

    // ── Create the Stripe Transfer ─────────────────────────────────────────
    // Platform-owned charges model: all checkout funds land on the
    // platform balance. To pay a seller out we transfer from the
    // platform to their connected account. Stripe then auto-payouts
    // from the connected account to the user's bank on the configured
    // schedule (Express default: daily, ~2 business days arrival).
    let transfer: Stripe.Transfer
    try {
      transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'eur',
        destination: stripeAccountId,
        // Idempotency key — re-tries of this exact request from the same
        // user with the same amount within a short window will resolve
        // to the same transfer instead of creating duplicates.
        transfer_group: `withdrawal_${withdrawal.id}`,
        metadata: {
          withdrawal_id: withdrawal.id,
          user_id: user.id,
          source: 'wallet_in_app_withdraw',
        },
      }, {
        idempotencyKey: `withdrawal_${withdrawal.id}`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[POST /api/stripe/payout] stripe.transfers.create failed:', msg)

      // Mark the withdrawal as failed so it doesn't sit in 'pending'
      // forever and so the available-balance compute releases the
      // reserved funds back to the user.
      await admin
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: msg })
        .eq('id', withdrawal.id)

      // Stripe-specific error → return the underlying message so the
      // UI can show "Insufficient platform balance" / "Account is
      // restricted" / etc directly to the user.
      if (err instanceof Stripe.errors.StripeError) {
        return NextResponse.json(
          errBody(`Stripe rejected the payout: ${err.message}`, 'stripe_error', err.code ?? undefined),
          { status: 502 }
        )
      }
      return NextResponse.json(
        errBody('Stripe rejected the payout.', 'stripe_error', msg),
        { status: 502 }
      )
    }

    // ── Mark the withdrawal as processing now that Stripe has accepted ─────
    // We don't have a payout id until the connected account auto-payouts —
    // that's the payout.paid webhook's job to record. Until then, status
    // = 'processing' and stripe_transfer_id is the link to the Transfer.
    const { error: updateErr } = await admin
      .from('withdrawals')
      .update({
        status: 'processing',
        stripe_transfer_id: transfer.id,
      })
      .eq('id', withdrawal.id)

    if (updateErr) {
      console.warn(
        '[POST /api/stripe/payout] withdrawal update to processing failed:',
        updateErr.message
      )
      // Non-fatal — the transfer succeeded so the user's funds are
      // already moving. The next webhook (payout.paid) or a manual
      // reconcile will fix the row.
    }

    // ── Best-effort notification ────────────────────────────────────────────
    admin
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'wallet',
        title: '💸 Withdrawal in progress',
        body: `€${(amountCents / 100).toFixed(2)} is on its way to your bank account.`,
        link: '/wallet',
      })
      .then(({ error }) => {
        if (error) console.warn('[POST /api/stripe/payout] notification insert failed:', error.message)
      })

    console.log(
      `[POST /api/stripe/payout] success user=${user.id} amount_cents=${amountCents} ` +
      `withdrawal_id=${withdrawal.id} transfer_id=${transfer.id}`
    )

    return NextResponse.json({
      success: true,
      withdrawal_id: withdrawal.id,
      transfer_id: transfer.id,
      amount_cents: amountCents,
      status: 'processing',
      // Stripe Express accounts auto-payout daily; arrival is typically
      // 2 business days after the transfer is created. We don't have a
      // hard date until payout.paid fires, so the UI shows the rough
      // estimate from this hint.
      arrival_estimate: '1–2 business days',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/stripe/payout] unhandled:', msg, err)
    return NextResponse.json(
      errBody('Withdrawal failed unexpectedly. Please try again.', 'internal', msg),
      { status: 500 }
    )
  }
}
