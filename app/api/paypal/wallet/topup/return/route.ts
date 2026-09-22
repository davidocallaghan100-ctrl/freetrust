import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capturePayPalOrder, getPayPalCaptureId, getPayPalOrder } from '@/lib/paypal'
import { insertNotification } from '@/lib/notifications/insert'
import { sendEmail } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

function redirect(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/wallet${query}`, req.url))
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const depositId = url.searchParams.get('deposit_id')
  const paypalOrderId = url.searchParams.get('token')
  if (!depositId || !paypalOrderId) return redirect(req, '?paypal_topup=error')

  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(`/api/paypal/wallet/topup/return?deposit_id=${depositId}&token=${paypalOrderId}`)}`, req.url))
  }

  const admin = createAdminClient()
  const { data: deposit, error: depositError } = await admin
    .from('money_deposits')
    .select('id, user_id, amount_cents, currency, provider, status, paypal_order_id, paypal_capture_id')
    .eq('id', depositId)
    .maybeSingle()

  if (depositError || !deposit || deposit.user_id !== user.id || deposit.provider !== 'paypal' || deposit.paypal_order_id !== paypalOrderId) {
    return redirect(req, '?paypal_topup=error')
  }
  if (deposit.status === 'completed') return redirect(req, '?paypal_topup=success&replayed=1')
  if (deposit.status !== 'pending') return redirect(req, '?paypal_topup=error')

  try {
    const approved = await getPayPalOrder(paypalOrderId)
    const purchaseUnit = approved.purchase_units?.[0]
    const paypalAmount = Number(purchaseUnit?.amount?.value ?? NaN)
    const paypalCurrency = purchaseUnit?.amount?.currency_code?.toUpperCase()
    if (!Number.isFinite(paypalAmount) || Math.abs(paypalAmount - Number(deposit.amount_cents) / 100) > 0.01 || paypalCurrency !== 'EUR' || deposit.currency.toLowerCase() !== 'eur') {
      throw new Error('PayPal amount or currency did not match the wallet top-up')
    }

    let captureId = deposit.paypal_capture_id as string | null
    if (approved.status === 'APPROVED') {
      try {
        const captured = await capturePayPalOrder(paypalOrderId)
        if (captured.status && captured.status !== 'COMPLETED') throw new Error(`Unexpected PayPal capture status: ${captured.status}`)
        captureId = getPayPalCaptureId(captured)
      } catch (captureError) {
        // A timeout can happen after PayPal accepted the capture. Re-read the
        // order before treating the attempt as failed; the request id in the
        // PayPal helper is deterministic and safe to retry.
        const refreshed = await getPayPalOrder(paypalOrderId)
        if (refreshed.status !== 'COMPLETED') throw captureError
        captureId = getPayPalCaptureId(refreshed)
      }
    } else if (approved.status === 'COMPLETED') {
      captureId = captureId ?? getPayPalCaptureId(approved)
    } else {
      throw new Error(`Unexpected PayPal wallet top-up status: ${approved.status ?? 'unknown'}`)
    }

    if (!captureId) throw new Error('PayPal did not return a capture id')

    const { data: completedDeposit, error: updateError } = await admin
      .from('money_deposits')
      .update({
        status: 'completed',
        paypal_capture_id: captureId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deposit.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError

    if (completedDeposit) {
      const amount = Number(deposit.amount_cents) / 100
      await insertNotification({
        userId: user.id,
        type: 'wallet',
        title: '💰 PayPal funds added!',
        body: `€${amount.toFixed(2)} has been added to your FreeTrust wallet via PayPal.`,
        link: '/wallet',
      })
      sendEmail({ type: 'wallet_topup', userId: user.id, payload: { amount } }).catch(() => {})
    }

    return redirect(req, `?paypal_topup=success&amount=${encodeURIComponent(String(deposit.amount_cents))}`)
  } catch (error) {
    // Do not mark a deposit failed after an uncertain capture. Leaving it
    // pending lets a retry re-read PayPal and recover a completed capture.
    console.error('[PayPal wallet top-up return] capture/reconciliation failed', error)
    return redirect(req, '?paypal_topup=error')
  }
}
