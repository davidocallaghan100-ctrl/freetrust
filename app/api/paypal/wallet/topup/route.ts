import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayPalOrder, getPayPalApprovalUrl, isPayPalWalletAvailable } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export async function POST(req: NextRequest) {
  if (!isPayPalWalletAvailable()) {
    return NextResponse.json({ error: 'PayPal is not currently available' }, { status: 503 })
  }

  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null) as { amount_cents?: unknown } | null
    const amountCents = Number(body?.amount_cents)
    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 1_000_000) {
      return NextResponse.json({ error: 'Invalid amount (min €1, max €10,000)' }, { status: 400 })
    }

    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim() || randomUUID()
    const admin = createAdminClient()

    const { data: existing, error: existingError } = await admin
      .from('money_deposits')
      .select('id, status, paypal_approval_url, paypal_order_id')
      .eq('user_id', user.id)
      .eq('provider', 'paypal')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingError) {
      console.error('[PayPal wallet top-up] idempotency lookup failed', existingError)
      return NextResponse.json({ error: 'Could not check the existing wallet top-up.' }, { status: 500 })
    }

    if (existing?.status === 'pending' && existing.paypal_approval_url) {
      return NextResponse.json({ url: existing.paypal_approval_url, deposit_id: existing.id, gateway: 'paypal' })
    }
    if (existing?.status === 'pending') {
      // Another request is still creating the PayPal order. Do not create a
      // second order while the unique idempotency key is in flight.
      return NextResponse.json({ deposit_id: existing.id, status: 'pending', error: 'This wallet top-up is still being prepared.' }, { status: 202 })
    }
    if (existing?.status === 'completed') {
      return NextResponse.json({ error: 'This PayPal top-up has already completed.', deposit_id: existing.id }, { status: 409 })
    }
    if (existing?.status === 'failed') {
      return NextResponse.json({ error: 'This wallet top-up failed to start. Please try again.', deposit_id: existing.id }, { status: 409 })
    }

    const { data: deposit, error: depositError } = await admin
      .from('money_deposits')
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        currency: 'eur',
        provider: 'paypal',
        status: 'pending',
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single()

    if (depositError || !deposit) {
      if (depositError?.code === '23505') {
        // A concurrent request won the unique idempotency race. Return its
        // state instead of surfacing an opaque database error.
        const { data: raced } = await admin
          .from('money_deposits')
          .select('id, status, paypal_approval_url')
          .eq('user_id', user.id)
          .eq('provider', 'paypal')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()
        if (raced?.status === 'pending' && raced.paypal_approval_url) {
          return NextResponse.json({ url: raced.paypal_approval_url, deposit_id: raced.id, gateway: 'paypal' })
        }
        if (raced) {
          return NextResponse.json({ deposit_id: raced.id, status: raced.status, error: 'This wallet top-up is already being processed.' }, { status: 202 })
        }
      }
      console.error('[PayPal wallet top-up] deposit insert failed', depositError)
      return NextResponse.json({ error: 'Could not create the wallet top-up.' }, { status: 500 })
    }

    try {
      const paypalOrder = await createPayPalOrder({
        referenceId: deposit.id,
        customId: deposit.id,
        description: 'FreeTrust wallet top-up',
        amountCents,
        intent: 'CAPTURE',
        requestId: `freetrust-wallet-topup-${deposit.id}`,
        returnUrl: `${BASE_URL}/api/paypal/wallet/topup/return?deposit_id=${encodeURIComponent(deposit.id)}`,
        cancelUrl: `${BASE_URL}/api/paypal/wallet/topup/cancel?deposit_id=${encodeURIComponent(deposit.id)}`,
      })
      const approvalUrl = getPayPalApprovalUrl(paypalOrder)
      if (!paypalOrder.id || !approvalUrl) throw new Error('PayPal did not return an approval URL')

      const { error: updateError } = await admin
        .from('money_deposits')
        .update({
          paypal_order_id: paypalOrder.id,
          paypal_approval_url: approvalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.id)
        .eq('status', 'pending')
      if (updateError) throw updateError

      return NextResponse.json({ url: approvalUrl, deposit_id: deposit.id, gateway: 'paypal' })
    } catch (paypalError) {
      await admin.from('money_deposits').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', deposit.id).eq('status', 'pending')
      console.error('[PayPal wallet top-up] order creation failed', paypalError)
      return NextResponse.json({ error: 'Could not start the PayPal wallet top-up.' }, { status: 502 })
    }
  } catch (error) {
    console.error('[POST /api/paypal/wallet/topup]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
