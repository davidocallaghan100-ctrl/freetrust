import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizePayPalOrder, capturePayPalOrder, getPayPalAuthorizationId, getPayPalCaptureId, getPayPalOrder, sendPayPalPayout } from '@/lib/paypal'
import { insertNotification } from '@/lib/notifications/insert'
import { logActivity } from '@/lib/activity/logActivity'

export const dynamic = 'force-dynamic'

function redirect(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url))
}

function withPayPalState(path: string, state: 'error' | 'cancel') {
  return `${path}${path.includes('?') ? '&' : '?'}paypal=${state}`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orderId = url.searchParams.get('order_id')
  const paypalOrderId = url.searchParams.get('token')
  if (!orderId || !paypalOrderId) return redirect(req, '/services?paypal=error')

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return redirect(req, `/login?redirect=${encodeURIComponent(`/api/paypal/return?order_id=${orderId}`)}`)

  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, listing_id, title, amount, payment_amount_cents, payment_gateway, paypal_order_id, paypal_intent, paypal_capture_id, type, status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order || order.buyer_id !== user.id || order.payment_gateway !== 'paypal' || order.paypal_order_id !== paypalOrderId) {
    return redirect(req, '/services?paypal=error')
  }

  const returnPath = order.listing_id ? `/checkout?service=${encodeURIComponent(order.listing_id)}` : '/products'
  if (order.status === 'paid') return redirect(req, `/orders/${order.id}/success?gateway=paypal`)
  if (order.status === 'completed') return redirect(req, `/orders/${order.id}/success?gateway=paypal`)
  if (order.status !== 'pending_escrow') return redirect(req, withPayPalState(returnPath, 'error'))

  try {
    const approved = await getPayPalOrder(paypalOrderId)
    const captureAlreadyRecorded = order.paypal_intent === 'CAPTURE' && Boolean(order.paypal_capture_id)
    const authorizationAlreadyRecorded = order.paypal_intent === 'AUTHORIZE' && Boolean(getPayPalAuthorizationId(approved))
    if (approved.status !== 'APPROVED' && !(captureAlreadyRecorded && approved.status === 'COMPLETED') && !authorizationAlreadyRecorded) {
      throw new Error(`Unexpected PayPal order status: ${approved.status ?? 'unknown'}`)
    }

    const purchaseUnit = approved.purchase_units?.[0]
    const paypalAmount = Number(purchaseUnit?.amount?.value ?? NaN)
    const expectedAmount = Number(order.payment_amount_cents ?? order.amount ?? 0) / 100
    if (!Number.isFinite(paypalAmount) || Math.abs(paypalAmount - expectedAmount) > 0.01) {
      throw new Error('PayPal amount did not match the FreeTrust order')
    }

    if (order.paypal_intent === 'CAPTURE') {
      let captureId = order.paypal_capture_id as string | null
      if (!captureId) {
        const captured = await capturePayPalOrder(paypalOrderId)
        if (captured.status && captured.status !== 'COMPLETED') throw new Error(`Unexpected PayPal capture status: ${captured.status}`)
        captureId = getPayPalCaptureId(captured)
      }
      if (!captureId) throw new Error('PayPal did not return a capture id')

      const { data: items, error: itemError } = await admin
        .from('order_items')
        .select('id, listing_id, seller_id, title, seller_payout_cents, paypal_payout_batch_id, paypal_payout_status')
        .eq('order_id', order.id)
      if (itemError) throw itemError

      // Persist the capture before attempting seller payouts. If the browser
      // return is interrupted after capture, a retry must not attempt to
      // capture the PayPal order again.
      const { error: captureStateError } = await admin
        .from('orders')
        .update({
          paypal_capture_id: captureId,
          paypal_payout_status: 'PROCESSING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'pending_escrow')
      if (captureStateError) throw captureStateError

      const sellerIds = Array.from(new Set((items ?? []).map(item => item.seller_id).filter(Boolean))) as string[]
      const { data: sellers } = sellerIds.length
        ? await admin.from('profiles').select('id, paypal_email').in('id', sellerIds)
        : { data: [] as Array<{ id: string; paypal_email: string | null }> }
      const sellerMap = new Map(((sellers ?? []) as Array<{ id: string; paypal_email: string | null }>).map(seller => [seller.id, seller.paypal_email]))
      const payoutBatchIds: string[] = []
      let payoutFailure = false

      for (const item of items ?? []) {
        if (item.paypal_payout_batch_id && item.paypal_payout_status !== 'failed') {
          payoutBatchIds.push(item.paypal_payout_batch_id)
          continue
        }
        const email = item.seller_id ? sellerMap.get(item.seller_id) : null
        if (!email) {
          payoutFailure = true
          await admin.from('order_items').update({ paypal_payout_status: 'failed', paypal_payout_error: 'Seller has not configured a PayPal payout email', updated_at: new Date().toISOString() }).eq('id', item.id)
          continue
        }
        try {
          const payout = await sendPayPalPayout({
            orderId: `${order.id}-${item.id}`,
            recipientEmail: email,
            amountCents: Number(item.seller_payout_cents ?? 0),
            note: `FreeTrust payout for ${item.title}`,
          })
          const batchId = payout.batch_header?.payout_batch_id ?? null
          if (!batchId) throw new Error('PayPal did not return a payout batch id')
          payoutBatchIds.push(batchId)
          await admin.from('order_items').update({ paypal_payout_batch_id: batchId, paypal_payout_status: payout.batch_header?.batch_status ?? 'PENDING', paypal_payout_error: null, updated_at: new Date().toISOString() }).eq('id', item.id)
        } catch (payoutError) {
          payoutFailure = true
          const message = payoutError instanceof Error ? payoutError.message : 'PayPal payout failed'
          await admin.from('order_items').update({ paypal_payout_status: 'failed', paypal_payout_error: message, updated_at: new Date().toISOString() }).eq('id', item.id)
          console.error('[PayPal Return] basket payout failed', { orderId: order.id, itemId: item.id, message })
        }
      }

      await admin
        .from('orders')
        .update({
          status: 'paid',
          paypal_payout_batch_id: payoutBatchIds.join(',') || null,
          paypal_payout_status: payoutFailure ? 'PARTIAL_FAILURE' : 'SUBMITTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      const purchasedListingIds = Array.from(new Set(
        (items ?? [])
          .map(item => item.listing_id)
          .filter((listingId): listingId is string => typeof listingId === 'string' && listingId.length > 0),
      ))
      if (purchasedListingIds.length > 0) {
        const { error: basketCleanupError } = await admin
          .from('basket_items')
          .delete()
          .eq('user_id', order.buyer_id)
          .eq('product_type', 'community')
          .in('listing_id', purchasedListingIds)
        if (basketCleanupError) console.error('[PayPal Return] basket cleanup failed', { orderId: order.id, message: basketCleanupError.message })
      }
      await insertNotification({
        userId: order.buyer_id,
        type: 'order',
        title: 'Basket order confirmed!',
        body: payoutFailure
          ? `Your PayPal basket payment is confirmed. One or more seller payouts need support review.`
          : `Your PayPal product basket order is confirmed.`,
        link: `/orders/${order.id}`,
      })
      await admin.rpc('issue_trust', {
        p_user_id: order.buyer_id,
        p_amount: 5,
        p_type: 'purchase_reward',
        p_ref: order.id,
        p_desc: '₮5 trust reward for FreeTrust product basket purchase',
      })
      return redirect(req, `/orders/${order.id}/success?gateway=paypal`)
    }

    let authorizationId = getPayPalAuthorizationId(approved)
    if (!authorizationId) {
      if (approved.status !== 'APPROVED') throw new Error(`Unexpected PayPal authorization order status: ${approved.status ?? 'unknown'}`)
      const authorized = await authorizePayPalOrder(paypalOrderId)
      authorizationId = getPayPalAuthorizationId(authorized)
    }
    if (!authorizationId) throw new Error('PayPal did not return an authorization id')

    const { error: updateError } = await admin
      .from('orders')
      .update({
        status: 'paid',
        paypal_authorization_id: authorizationId,
        payment_amount_cents: Math.round(expectedAmount * 100),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'pending_escrow')
    if (updateError) throw updateError

    void logActivity({
      orderId: order.id,
      actorRole: 'system',
      eventType: 'payment_confirmed',
      title: 'Payment confirmed',
      body: 'PayPal funds are authorized and held until delivery is confirmed.',
    })

    await insertNotification({
      userId: order.buyer_id,
      type: 'order',
      title: 'Order confirmed!',
      body: `Your order for "${order.title}" is confirmed. You earned ₮5 trust!`,
      link: `/orders/${order.id}`,
    })

    await admin.rpc('issue_trust', {
      p_user_id: order.buyer_id,
      p_amount: 5,
      p_type: 'purchase_reward',
      p_ref: order.id,
      p_desc: `₮5 trust reward for purchasing: ${order.title}`,
    })

    return redirect(req, `/orders/${order.id}/success?gateway=paypal`)
  } catch (error) {
    console.error('[PayPal Return] authorization failed', error)
    return redirect(req, withPayPalState(returnPath, 'error'))
  }
}
