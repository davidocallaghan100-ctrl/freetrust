export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { insertNotification } from '@/lib/notifications/insert'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') // 'buyer' | 'seller' | null (both)
    const status = searchParams.get('status')

    let query = supabase
      .from('orders')
      .select(`
        *,
        buyer:buyer_id(id, email, raw_user_meta_data),
        seller:seller_id(id, email, raw_user_meta_data)
      `)
      .order('created_at', { ascending: false })

    if (role === 'buyer') {
      query = query.eq('buyer_id', user.id)
    } else if (role === 'seller') {
      query = query.eq('seller_id', user.id)
    } else {
      // Return both buying and selling orders
      query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query

    if (error) {
      // If table doesn't exist yet, return empty
      if (error.code === '42P01') {
        return NextResponse.json({ orders: [] })
      }
      console.error('[Orders GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (err) {
    console.error('[Orders GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/orders — create a new order and fire email + in-app notifications
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      listing_id?: string
      seller_id?: string
      title?: string
      item_title?: string // legacy alias — accepted but mapped to title
      amount?: number
      currency?: string
      type?: string
      notes?: string
      delivery_address?: string
    }

    const orderTitle = body.title ?? body.item_title

    if (!body.seller_id || !orderTitle || body.amount == null) {
      return NextResponse.json({ error: 'Missing required fields: seller_id, title, amount' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Insert the order
    const { data: order, error: insertErr } = await admin
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: body.seller_id,
        listing_id: body.listing_id ?? null,
        title: orderTitle,
        amount: body.amount,
        currency: body.currency ?? 'EUR',
        type: body.type ?? 'product',
        notes: body.notes ?? null,
        delivery_address: body.delivery_address ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr || !order) {
      console.error('[Orders POST] insert error:', insertErr)
      return NextResponse.json({ error: insertErr?.message ?? 'Failed to create order' }, { status: 500 })
    }

    // Fire notifications + emails non-blocking after response is ready
    Promise.all([
      // Buyer notification + email
      insertNotification({
        userId: user.id,
        type: 'order',
        title: `Order placed: ${orderTitle}`,
        body: `Your order for "${orderTitle}" (€${body.amount.toFixed(2)}) has been placed.`,
        link: `/orders/${order.id}`,
      }),
      sendEmail({
        type: 'order_placed',
        userId: user.id,
        payload: { orderTitle, amount: body.amount, orderId: order.id },
      }),
      // Seller notification + email
      insertNotification({
        userId: body.seller_id,
        type: 'order',
        title: `New order: ${orderTitle}`,
        body: `You received a new order for "${orderTitle}" (€${body.amount.toFixed(2)}).`,
        link: `/orders/${order.id}`,
      }),
      sendEmail({
        type: 'order_placed',
        userId: body.seller_id,
        payload: { orderTitle, amount: body.amount, orderId: order.id },
      }),
    ]).catch(err => console.error('[Orders POST] notification/email error:', err))

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    console.error('[Orders POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
