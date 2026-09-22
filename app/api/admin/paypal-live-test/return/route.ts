import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFreeTrustAdmin } from '@/lib/admin/access'
import { capturePayPalOrder, getPayPalCaptureId, getPayPalOrder } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

function redirect(req: Request, query: string) {
  return NextResponse.redirect(new URL(`/admin/paypal-live-test${query}`, req.url))
}

export async function GET(req: Request) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const runId = url.searchParams.get('run_id')
  const paypalOrderId = url.searchParams.get('token')
  if (!runId || !paypalOrderId) return redirect(req, '?result=error&message=missing_paypal_state')

  const admin = createAdminClient()
  const { data: run, error: runError } = await admin
    .from('paypal_live_test_runs')
    .select('id, created_by, paypal_order_id, status, amount_cents, currency')
    .eq('id', runId)
    .maybeSingle()

  if (runError || !run || run.created_by !== auth.user.id || run.paypal_order_id !== paypalOrderId) {
    return redirect(req, '?result=error&message=invalid_test_state')
  }

  if (run.status === 'captured') return redirect(req, `?result=success&run_id=${encodeURIComponent(run.id)}&replayed=1`)
  if (run.status !== 'pending') return redirect(req, '?result=error&message=test_not_pending')

  try {
    const approved = await getPayPalOrder(paypalOrderId)
    const amount = Number(approved.purchase_units?.[0]?.amount?.value ?? NaN)
    if (approved.status !== 'APPROVED' || amount !== run.amount_cents / 100 || run.currency !== 'EUR') {
      throw new Error('PayPal approval did not match the fixed €1 EUR test amount')
    }

    const captured = await capturePayPalOrder(paypalOrderId)
    if (captured.status && captured.status !== 'COMPLETED') throw new Error(`Unexpected PayPal capture status: ${captured.status}`)
    const captureId = getPayPalCaptureId(captured)
    if (!captureId) throw new Error('PayPal did not return a capture id')

    const { error: updateError } = await admin
      .from('paypal_live_test_runs')
      .update({ status: 'captured', paypal_capture_id: captureId, captured_at: new Date().toISOString(), error_message: null })
      .eq('id', run.id)
      .eq('status', 'pending')
    if (updateError) throw updateError

    return redirect(req, `?result=success&run_id=${encodeURIComponent(run.id)}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PayPal live test capture failed'
    await admin.from('paypal_live_test_runs').update({ status: 'failed', error_message: message }).eq('id', run.id).eq('status', 'pending')
    console.error('[PayPal live test] capture failed', message)
    return redirect(req, `?result=error&run_id=${encodeURIComponent(run.id)}&message=capture_failed`)
  }
}
