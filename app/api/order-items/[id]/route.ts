export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'
import { hasRecordedBasketPayout } from '@/lib/orders/basket'

type ItemStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'disputed'

function validateTrackingUrl(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > 500) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    action?: string
    delivery_status?: ItemStatus
    tracking_carrier?: string | null
    tracking_number?: string | null
    tracking_url?: string | null
    delivery_notes?: string | null
  } | null
  if (!body?.action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  try {
    const { id } = params
    const admin = createAdminClient()
    const { data: item, error: itemError } = await admin
      .from('order_items')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (itemError || !item) return NextResponse.json({ error: 'Order item not found' }, { status: 404 })

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, type, status, title, payment_gateway')
      .eq('id', item.order_id)
      .maybeSingle()

    if (orderError || !order || order.type !== 'product_basket') {
      return NextResponse.json({ error: 'Product basket order not found' }, { status: 404 })
    }

    if (body.action === 'confirm_received') {
      if (user.id !== item.buyer_id || user.id !== order.buyer_id) {
        return NextResponse.json({ error: 'Only the buyer can confirm receipt' }, { status: 403 })
      }
      if (item.delivery_status !== 'delivered') {
        return NextResponse.json({ error: 'The seller must mark this item delivered before you can confirm receipt' }, { status: 409 })
      }
      if (order.status !== 'paid' || !hasRecordedBasketPayout(order.payment_gateway, item)) {
        return NextResponse.json({ error: 'Seller payout is not confirmed yet; this order needs payment reconciliation' }, { status: 409 })
      }

      const now = new Date().toISOString()
      const { data: updated, error: updateError } = await admin
        .from('order_items')
        .update({ delivery_status: 'completed', completed_at: now, updated_at: now })
        .eq('id', id)
        .eq('buyer_id', user.id)
        .eq('delivery_status', 'delivered')
        .select('id, delivery_status, completed_at')
        .maybeSingle()
      if (updateError) return NextResponse.json({ error: 'Could not confirm receipt' }, { status: 500 })
      if (!updated) return NextResponse.json({ error: 'The item status changed; refresh and try again' }, { status: 409 })

      void insertNotification({
        userId: item.seller_id,
        type: 'order',
        title: 'Product received',
        body: `The buyer confirmed receipt of "${item.title}". This confirms fulfillment; it does not change the already-submitted payout.`,
        link: `/orders/${order.id}`,
      }).catch(error => console.error('[order-items] seller receipt notification failed', error))

      return NextResponse.json({ item: updated })
    }

    if (body.action !== 'update_fulfillment') {
      return NextResponse.json({ error: 'Unsupported order item action' }, { status: 400 })
    }
    if (user.id !== item.seller_id) return NextResponse.json({ error: 'Only the item seller can update fulfillment' }, { status: 403 })
    if (order.status !== 'paid' || !hasRecordedBasketPayout(order.payment_gateway, item)) {
      return NextResponse.json({ error: 'Seller payout is not confirmed yet; fulfillment is locked pending reconciliation' }, { status: 409 })
    }

    const requestedStatus = body.delivery_status
    if (!requestedStatus || !['processing', 'shipped', 'delivered'].includes(requestedStatus)) {
      return NextResponse.json({ error: 'Choose processing, shipped, or delivered' }, { status: 400 })
    }
    const nextStatus = requestedStatus as 'processing' | 'shipped' | 'delivered'
    const currentStatus = (item.delivery_status ?? (order.status === 'paid' ? 'paid' : 'pending')) as ItemStatus
    const allowedFrom: Record<'processing' | 'shipped' | 'delivered', ItemStatus[]> = {
      processing: ['pending', 'paid', 'processing'],
      shipped: ['pending', 'paid', 'processing', 'shipped'],
      delivered: ['pending', 'paid', 'processing', 'shipped'],
    }
    if (!allowedFrom[nextStatus].includes(currentStatus)) {
      return NextResponse.json({ error: `Cannot change fulfillment from ${currentStatus} to ${nextStatus}` }, { status: 409 })
    }

    const trackingUrl = body.tracking_url === undefined ? undefined : validateTrackingUrl(body.tracking_url)
    if (trackingUrl === undefined && body.tracking_url !== undefined) return NextResponse.json({ error: 'Tracking URL must be a valid http(s) URL' }, { status: 400 })
    if (body.tracking_carrier != null && (typeof body.tracking_carrier !== 'string' || body.tracking_carrier.trim().length > 80)) {
      return NextResponse.json({ error: 'Carrier name is too long' }, { status: 400 })
    }
    if (body.tracking_number != null && (typeof body.tracking_number !== 'string' || body.tracking_number.trim().length > 120)) {
      return NextResponse.json({ error: 'Tracking number is too long' }, { status: 400 })
    }
    if (body.delivery_notes != null && (typeof body.delivery_notes !== 'string' || body.delivery_notes.trim().length > 1000)) {
      return NextResponse.json({ error: 'Delivery notes must be 1000 characters or fewer' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, string | null> = {
      delivery_status: nextStatus,
      updated_at: now,
    }
    if (body.tracking_carrier !== undefined) updates.tracking_carrier = body.tracking_carrier?.trim() || null
    if (body.tracking_number !== undefined) updates.tracking_number = body.tracking_number?.trim() || null
    if (body.tracking_url !== undefined) updates.tracking_url = trackingUrl ?? null
    if (body.delivery_notes !== undefined) updates.delivery_notes = body.delivery_notes?.trim() || null
    if (nextStatus === 'shipped' && !item.shipped_at) updates.shipped_at = now
    if (nextStatus === 'delivered' && !item.delivered_at) updates.delivered_at = now

    let updateQuery = admin.from('order_items').update(updates).eq('id', id).eq('seller_id', user.id)
    if (item.delivery_status == null) updateQuery = updateQuery.is('delivery_status', null)
    else updateQuery = updateQuery.eq('delivery_status', item.delivery_status)
    const { data: updated, error: updateError } = await updateQuery
      .select('id, delivery_status, tracking_carrier, tracking_number, tracking_url, delivery_notes, shipped_at, delivered_at')
      .maybeSingle()

    if (updateError) return NextResponse.json({ error: 'Could not save fulfillment update' }, { status: 500 })
    if (!updated) return NextResponse.json({ error: 'The item status changed; refresh and try again' }, { status: 409 })

    void insertNotification({
      userId: item.buyer_id,
      type: 'order',
      title: nextStatus === 'delivered' ? 'Product delivered' : 'Product fulfillment updated',
      body: nextStatus === 'shipped'
        ? `"${item.title}" has shipped${body.tracking_carrier ? ` with ${body.tracking_carrier}` : ''}.`
        : nextStatus === 'delivered'
          ? `"${item.title}" has been marked delivered. Confirm receipt when it arrives.`
          : `The seller updated fulfillment for "${item.title}".`,
      link: `/orders/${order.id}`,
    }).catch(error => console.error('[order-items] buyer fulfillment notification failed', error))

    return NextResponse.json({ item: updated })
  } catch (error) {
    console.error('[order-items] fulfillment update failed', error)
    return NextResponse.json({ error: 'Could not update fulfillment' }, { status: 500 })
  }
}
