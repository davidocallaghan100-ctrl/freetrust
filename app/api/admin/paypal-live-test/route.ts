import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFreeTrustAdmin } from '@/lib/admin/access'
import { createPayPalOrder, getPayPalApprovalUrl, getPayPalEnvironment, isPayPalAvailable } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

const AMOUNT_CENTS = 100
const TEST_GROUP = 'paypal_live_eur_1'

function isEnabled() {
  return process.env.PAYPAL_LIVE_TEST_ENABLED === 'true'
    && process.env.VERCEL_ENV === 'production'
    && getPayPalEnvironment() === 'live'
    && isPayPalAvailable()
}

export async function POST(req: Request) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  if (!isEnabled()) {
    return NextResponse.json({ error: 'The live PayPal smoke test is disabled.' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: active, error: activeError } = await admin
    .from('paypal_live_test_runs')
    .select('id, status, approval_url, paypal_order_id')
    .eq('test_group', TEST_GROUP)
    .in('status', ['pending', 'captured'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeError) {
    console.error('[PayPal live test] active run lookup failed', activeError)
    return NextResponse.json({ error: 'Could not inspect the live test state.' }, { status: 500 })
  }

  if (active?.status === 'captured') {
    return NextResponse.json({ error: 'The one-use live PayPal test has already been captured.', run_id: active.id }, { status: 409 })
  }

  if (active?.status === 'pending' && active.approval_url) {
    return NextResponse.json({ approval_url: active.approval_url, run_id: active.id, amount_cents: AMOUNT_CENTS, reused: true })
  }

  const { data: run, error: runError } = await admin
    .from('paypal_live_test_runs')
    .insert({
      test_group: TEST_GROUP,
      created_by: auth.user.id,
      created_by_email: auth.user.email ?? '',
      amount_cents: AMOUNT_CENTS,
      currency: 'EUR',
      status: 'pending',
    })
    .select('id')
    .single()

  if (runError || !run) {
    // A concurrent request may have won the partial unique index race.
    const { data: concurrent } = await admin
      .from('paypal_live_test_runs')
      .select('id, status, approval_url')
      .eq('test_group', TEST_GROUP)
      .in('status', ['pending', 'captured'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (concurrent?.status === 'pending' && concurrent.approval_url) {
      return NextResponse.json({ approval_url: concurrent.approval_url, run_id: concurrent.id, amount_cents: AMOUNT_CENTS, reused: true })
    }
    console.error('[PayPal live test] run insert failed', runError)
    return NextResponse.json({ error: 'Could not reserve the one-use live test.' }, { status: 409 })
  }

  try {
    const baseUrl = new URL(req.url).origin
    const paypalOrder = await createPayPalOrder({
      referenceId: `live-test-${run.id}`,
      customId: `live-test-${run.id}`,
      description: 'FreeTrust PayPal live €1 smoke test',
      amountCents: AMOUNT_CENTS,
      intent: 'CAPTURE',
      returnUrl: `${baseUrl}/api/admin/paypal-live-test/return?run_id=${encodeURIComponent(run.id)}`,
      cancelUrl: `${baseUrl}/api/admin/paypal-live-test/cancel?run_id=${encodeURIComponent(run.id)}`,
    })
    const approvalUrl = getPayPalApprovalUrl(paypalOrder)
    if (!paypalOrder.id || !approvalUrl) throw new Error('PayPal did not return an approval URL')

    const { error: updateError } = await admin
      .from('paypal_live_test_runs')
      .update({ paypal_order_id: paypalOrder.id, approval_url: approvalUrl })
      .eq('id', run.id)
      .eq('status', 'pending')
    if (updateError) throw updateError

    return NextResponse.json({ approval_url: approvalUrl, run_id: run.id, amount_cents: AMOUNT_CENTS, reused: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PayPal live test order creation failed'
    await admin.from('paypal_live_test_runs').update({ status: 'failed', error_message: message }).eq('id', run.id).eq('status', 'pending')
    console.error('[PayPal live test] order creation failed', message)
    return NextResponse.json({ error: 'Could not create the live PayPal test order.' }, { status: 502 })
  }
}
