export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/disputes — list disputes (admin or own)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const adminView = searchParams.get('admin') === 'true'

    let query = supabase
      .from('disputes')
      .select(`
        *,
        raiser:profiles!raised_by(id, full_name, avatar_url),
        against:profiles!against_user(id, full_name, avatar_url),
        order:orders!order_id(id, title, amount, status)
      `)
      .order('created_at', { ascending: false })

    if (orderId) {
      query = query.eq('order_id', orderId)
    } else if (!adminView) {
      query = query.or(`raised_by.eq.${user.id},against_user.eq.${user.id}`)
    }

    const { data: disputes, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ disputes: disputes ?? [] }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (err) {
    console.error('[GET /api/disputes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/disputes — raise a dispute
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { order_id, reason, details, evidence_urls } = body

    if (!order_id || !reason) {
      return NextResponse.json({ error: 'order_id and reason are required' }, { status: 400 })
    }

    // Fetch order to validate window and get against_user
    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id, seller_id, status, dispute_window_ends, created_at')
      .eq('id', order_id)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    }

    // Check dispute window (if set)
    if (order.dispute_window_ends && new Date() > new Date(order.dispute_window_ends)) {
      return NextResponse.json({ error: 'Dispute window has closed' }, { status: 422 })
    }

    // Check no existing open dispute
    const { data: existing } = await supabase
      .from('disputes')
      .select('id')
      .eq('order_id', order_id)
      .eq('raised_by', user.id)
      .single()
    if (existing) return NextResponse.json({ error: 'Dispute already raised for this order' }, { status: 409 })

    const against_user = order.buyer_id === user.id ? order.seller_id : order.buyer_id

    const { data: dispute, error } = await supabase
      .from('disputes')
      .insert({
        order_id,
        raised_by: user.id,
        against_user,
        reason,
        details: details ?? null,
        evidence_urls: evidence_urls ?? [],
        status: 'open',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update order status
    await supabase.from('orders').update({ status: 'disputed' }).eq('id', order_id)

    return NextResponse.json({ dispute }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/disputes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
