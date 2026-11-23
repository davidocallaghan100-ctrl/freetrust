export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getPayPalPayoutBatch,
  getPayPalBasketSenderItemId,
  getPayPalPayoutStatus,
  isPayPalPayoutFailureStatus,
} from '@/lib/paypal'
import {
  canRefreshBasketPayout,
  getBasketPayoutState,
  hasRecordedBasketPayout,
} from '@/lib/orders/basket'

function payoutResult(gateway: unknown, item: Record<string, unknown>) {
  return {
    payout_ready: hasRecordedBasketPayout(gateway, item),
    payout_state: getBasketPayoutState(gateway, item),
    payout_status_checkable: canRefreshBasketPayout(gateway, item),
  }
}

/**
 * Refresh one paid PayPal basket item's payout state. This is read-only against
 * PayPal and never re-submits a payout. Only that order's buyer or item seller
 * may ask for a refresh; the batch ID and expected sender_item_id come from DB.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = params
    const admin = createAdminClient()
    const { data: item, error: itemError } = await admin
      .from('order_items')
      .select('id, order_id, buyer_id, seller_id, paypal_payout_batch_id, paypal_payout_status')
      .eq('id', id)
      .maybeSingle()

    if (itemError) return NextResponse.json({ error: 'Could not load payout status' }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    if (user.id !== item.buyer_id && user.id !== item.seller_id) {
      return NextResponse.json({ error: 'You cannot view this payout status' }, { status: 403 })
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, type, status, payment_gateway')
      .eq('id', item.order_id)
      .maybeSingle()

    if (orderError) return NextResponse.json({ error: 'Could not load payout status' }, { status: 500 })
    if (!order || order.type !== 'product_basket') {
      return NextResponse.json({ error: 'Product basket order not found' }, { status: 404 })
    }
    if (order.status !== 'paid' || order.payment_gateway !== 'paypal') {
      return NextResponse.json({ error: 'Only paid PayPal basket payouts can be refreshed' }, { status: 409 })
    }

    const batchId = item.paypal_payout_batch_id
    if (typeof batchId !== 'string' || !batchId) {
      return NextResponse.json({ error: 'No PayPal payout batch is recorded; support reconciliation is required' }, { status: 409 })
    }

    const current = payoutResult(order.payment_gateway, item)
    if (current.payout_ready || current.payout_state === 'failed') {
      return NextResponse.json(current, { headers: { 'Cache-Control': 'no-store' } })
    }

    const expectedSenderItemId = getPayPalBasketSenderItemId(order.id, item.id)
    const batch = await getPayPalPayoutBatch(batchId)
    const returnedBatchId = batch.batch_header?.payout_batch_id
    if (returnedBatchId && returnedBatchId !== batchId) {
      console.error('[PayPal basket payout status] Provider returned a different batch ID', { orderId: order.id, itemId: item.id })
      return NextResponse.json({ error: 'PayPal returned an unexpected payout batch' }, { status: 502 })
    }

    const payoutStatus = getPayPalPayoutStatus(batch, expectedSenderItemId)
    const failed = isPayPalPayoutFailureStatus(payoutStatus)
    let update = admin
      .from('order_items')
      .update({
        paypal_payout_status: payoutStatus,
        paypal_payout_error: failed ? `PayPal payout status: ${payoutStatus}` : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('paypal_payout_batch_id', batchId)

    // Avoid a stale in-flight response downgrading a newer success/failure.
    if (item.paypal_payout_status == null) update = update.is('paypal_payout_status', null)
    else update = update.eq('paypal_payout_status', item.paypal_payout_status)

    const { error: updateError } = await update
    if (updateError) {
      console.error('[PayPal basket payout status] Could not persist provider state', { orderId: order.id, itemId: item.id, message: updateError.message })
      return NextResponse.json({ error: 'PayPal status was checked but could not be saved; retry shortly' }, { status: 500 })
    }

    const { data: refreshedItem, error: refreshedItemError } = await admin
      .from('order_items')
      .select('paypal_payout_batch_id, paypal_payout_status')
      .eq('id', item.id)
      .maybeSingle()
    if (refreshedItemError || !refreshedItem) {
      return NextResponse.json({ error: 'PayPal status was checked but could not be reloaded' }, { status: 500 })
    }
    return NextResponse.json(payoutResult(order.payment_gateway, refreshedItem), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[PayPal basket payout status] Refresh failed', error)
    return NextResponse.json({ error: 'Could not refresh PayPal payout status; retry shortly' }, { status: 502 })
  }
}
