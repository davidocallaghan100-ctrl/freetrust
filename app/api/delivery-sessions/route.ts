import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/push/sendPushNotification'
import { logActivity } from '@/lib/activity/logActivity'

// POST: Start a delivery session (seller action)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { order_id, buyer_id, buyer_lat, buyer_lng, buyer_address } = body

  if (!order_id) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
  }

  // Verify this user is the seller
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, seller_id, buyer_id, status')
    .eq('id', order_id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.seller_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!['paid', 'in_progress'].includes(order.status)) {
    return NextResponse.json({ error: 'Order not in a deliverable state' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('delivery_sessions')
    .insert({
      order_id,
      seller_id: session.user.id,
      buyer_id: buyer_id ?? order.buyer_id,
      buyer_lat: buyer_lat ?? null,
      buyer_lng: buyer_lng ?? null,
      buyer_address: buyer_address ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify buyer that delivery has started (fire-and-forget)
  sendPushNotification({
    userId: order.buyer_id,
    title: '🚗 Your order is on the way!',
    message: 'Tap to track your delivery live on the map.',
    url: `/orders/${order_id}?track=1`,
  }).catch(() => {})

  // Log to activity feed (non-blocking)
  void logActivity({
    orderId:   order_id,
    actorId:   session.user.id,
    actorRole: 'seller',
    eventType: 'delivery_started',
    title:     'Seller started delivery',
    body:      'Live location tracking is now active.',
  })

  return NextResponse.json({ session: data })
}

// PATCH: End / update a delivery session (seller action)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { session_id, status } = body

  if (!session_id || !status) {
    return NextResponse.json({ error: 'session_id and status are required' }, { status: 400 })
  }

  if (!['completed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status. Must be completed or cancelled.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('delivery_sessions')
    .update({
      status,
      ended_at: new Date().toISOString(),
    })
    .eq('id', session_id)
    .eq('seller_id', session.user.id) // RLS: only seller can update their session
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log delivery end to activity feed (non-blocking)
  if (data?.order_id) {
    void logActivity({
      orderId:   data.order_id,
      actorId:   session.user.id,
      actorRole: 'seller',
      eventType: 'delivery_completed',
      title:     'Delivery tracking ended',
      body:      status === 'completed' ? 'Seller arrived at destination.' : 'Tracking cancelled.',
    })
  }

  return NextResponse.json({ session: data })
}
