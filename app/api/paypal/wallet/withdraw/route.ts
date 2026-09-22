import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPayPalWalletAvailable, sendPayPalPayout } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!isPayPalWalletAvailable()) return NextResponse.json({ error: 'PayPal wallet payments are not currently available' }, { status: 503 })

  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null) as { amount_cents?: unknown } | null
    const amountCents = Number(body?.amount_cents)
    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 1_000_000) {
      return NextResponse.json({ error: 'Invalid amount (min €1, max €10,000)' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('paypal_email')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) return NextResponse.json({ error: 'Could not load PayPal payout details' }, { status: 500 })

    const paypalEmail = typeof profile?.paypal_email === 'string' ? profile.paypal_email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
      return NextResponse.json({ error: 'Add and confirm your PayPal email before withdrawing.', code: 'paypal_email_required' }, { status: 400 })
    }

    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim() || randomUUID()
    const { data: withdrawalId, error: reserveError } = await admin.rpc('reserve_wallet_withdrawal', {
      p_user_id: user.id,
      p_amount_cents: amountCents,
      p_paypal_email: paypalEmail,
      p_idempotency_key: idempotencyKey,
    })
    if (reserveError || !withdrawalId) {
      const message = reserveError?.message ?? 'Could not reserve wallet funds'
      if (message.includes('insufficient_withdrawable_balance')) {
        return NextResponse.json({ error: 'Insufficient tracked wallet funds for this withdrawal.', code: 'insufficient_balance' }, { status: 400 })
      }
      console.error('[PayPal wallet withdrawal] reserve failed', reserveError)
      return NextResponse.json({ error: 'Could not reserve wallet funds.' }, { status: 500 })
    }

    const { data: withdrawal, error: withdrawalError } = await admin
      .from('wallet_withdrawals')
      .select('id, user_id, amount_cents, status, paypal_email, paypal_payout_batch_id, paypal_payout_status, error_message')
      .eq('id', withdrawalId)
      .eq('user_id', user.id)
      .single()
    if (withdrawalError || !withdrawal) return NextResponse.json({ error: 'Could not load withdrawal state.' }, { status: 500 })

    if (withdrawal.status === 'completed' || withdrawal.status === 'processing') {
      return NextResponse.json({ withdrawal_id: withdrawal.id, status: withdrawal.status, batch_id: withdrawal.paypal_payout_batch_id }, { status: 202 })
    }
    if (withdrawal.status === 'failed' || withdrawal.status === 'cancelled') {
      return NextResponse.json({ error: withdrawal.error_message ?? 'This withdrawal cannot be retried. Start a new withdrawal.' }, { status: 409 })
    }

    try {
      const payout = await sendPayPalPayout({
        orderId: `wallet-withdrawal-${withdrawal.id}`,
        recipientEmail: withdrawal.paypal_email,
        amountCents: Number(withdrawal.amount_cents),
        note: 'FreeTrust wallet withdrawal',
      })
      const batchId = payout.batch_header?.payout_batch_id ?? null
      if (!batchId) throw new Error('PayPal did not return a payout batch id')
      const batchStatus = (payout.batch_header?.batch_status ?? 'PENDING').toUpperCase()
      const completed = batchStatus === 'SUCCESS'
      await admin.from('wallet_withdrawals').update({
        status: completed ? 'completed' : 'processing',
        paypal_payout_batch_id: batchId,
        paypal_payout_status: batchStatus,
        error_message: null,
        updated_at: new Date().toISOString(),
        completed_at: completed ? new Date().toISOString() : null,
      }).eq('id', withdrawal.id).eq('status', 'pending')

      return NextResponse.json({ withdrawal_id: withdrawal.id, status: completed ? 'completed' : 'processing', batch_id: batchId }, { status: 202 })
    } catch (payoutError) {
      // Keep the reservation pending: a timeout may mean PayPal accepted the
      // payout. The deterministic PayPal request id makes a retry safe.
      const message = payoutError instanceof Error ? payoutError.message : 'PayPal payout could not be confirmed'
      await admin.from('wallet_withdrawals').update({ error_message: message, updated_at: new Date().toISOString() }).eq('id', withdrawal.id).eq('status', 'pending')
      console.error('[PayPal wallet withdrawal] payout attempt needs retry/reconciliation', message)
      return NextResponse.json({ error: 'PayPal payout needs retry or reconciliation.', code: 'withdrawal_pending', withdrawal_id: withdrawal.id }, { status: 502 })
    }
  } catch (error) {
    console.error('[POST /api/paypal/wallet/withdraw]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
