export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { insertNotification } from '@/lib/notifications/insert'
import { serializeBasketItem, serializeBasketOrderForViewer } from '@/lib/orders/basket'
import { serializeOrderSummary } from '@/lib/orders/serialization'

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

    const admin = createAdminClient()
    let query = admin
      .from('orders')
      .select('*')
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

    const { data: rawOrders, error } = await query

    if (error) {
      // If table doesn't exist yet, return empty
      if (error.code === '42P01') {
        return NextResponse.json({ orders: [] })
      }
      console.error('[Orders GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    const allOrders = rawOrders ?? []
    const ordinaryOrders = allOrders.filter(order => order.type !== 'product_basket')

    // Basket orders have no parent seller_id: each order_items row owns its
    // seller and payout state. Load the member's item rows separately and
    // hydrate their parent order rather than losing seller-side purchases.
    let itemQuery = admin.from('order_items').select('*')
    if (role === 'buyer') itemQuery = itemQuery.eq('buyer_id', user.id)
    else if (role === 'seller') itemQuery = itemQuery.eq('seller_id', user.id)
    else itemQuery = itemQuery.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)

    const { data: rawItems, error: itemsError } = await itemQuery.order('created_at', { ascending: false })
    if (itemsError && itemsError.code !== '42P01') {
      console.error('[Orders GET] Basket item query failed:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch basket orders' }, { status: 500 })
    }

    const itemRows = rawItems ?? []
    const basketOrderIds = Array.from(new Set(itemRows.map(item => item.order_id).filter(Boolean)))
    let parentOrders = allOrders.filter(order => order.type === 'product_basket')
    const parentOrderIdsNotLoaded = basketOrderIds.filter(id => !parentOrders.some(order => order.id === id))
    if (parentOrderIdsNotLoaded.length) {
      let parentQuery = admin.from('orders').select('*').in('id', parentOrderIdsNotLoaded).eq('type', 'product_basket')
      if (status) parentQuery = parentQuery.eq('status', status)
      const { data: extraParents, error: parentError } = await parentQuery
      if (parentError) {
        console.error('[Orders GET] Basket parent query failed:', parentError)
        return NextResponse.json({ error: 'Failed to fetch basket orders' }, { status: 500 })
      }
      parentOrders = [...parentOrders, ...(extraParents ?? [])]
    }

    const parentById = new Map(parentOrders.map(order => [order.id, order]))
    const visibleItems = itemRows.filter(item => {
      const parent = parentById.get(item.order_id)
      return parent?.type === 'product_basket' && (!status || parent.status === status)
    })
    const visibleParents = parentOrders
      .filter(order => visibleItems.some(item => item.order_id === order.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const profileIds = Array.from(new Set([
      ...ordinaryOrders.flatMap(order => [order.buyer_id, order.seller_id]),
      ...visibleItems.flatMap(item => [item.buyer_id, item.seller_id]),
    ].filter(Boolean)))
    const listingIds = Array.from(new Set(visibleItems.map(item => item.listing_id).filter(Boolean)))
    const [{ data: profiles }, { data: listings }] = await Promise.all([
      profileIds.length
        ? admin.from('profiles').select('id, full_name, avatar_url').in('id', profileIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> }),
      listingIds.length
        ? admin.from('listings').select('id, product_type').in('id', listingIds)
        : Promise.resolve({ data: [] as Array<{ id: string; product_type: string | null }> }),
    ])
    const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile]))
    const listingById = new Map((listings ?? []).map(listing => [listing.id, listing]))

    const enrichedOrders = ordinaryOrders.map(order => ({
      ...serializeOrderSummary(order),
      buyer_profile: profileById.get(order.buyer_id) ?? null,
      seller_profile: profileById.get(order.seller_id) ?? null,
    }))

    const basketOrders = visibleParents.map(order => {
      const orderItems = visibleItems.filter(item => item.order_id === order.id)
      return {
        ...serializeBasketOrderForViewer(order, user.id, orderItems),
        buyer_profile: profileById.get(order.buyer_id) ?? null,
        items: orderItems.map(item => ({
          ...serializeBasketItem(order.payment_gateway, item),
          buyer_profile: profileById.get(item.buyer_id) ?? profileById.get(order.buyer_id) ?? null,
          seller_profile: profileById.get(item.seller_id) ?? null,
          listing: item.listing_id ? listingById.get(item.listing_id) ?? null : null,
        })),
      }
    })

    return NextResponse.json({ orders: enrichedOrders, basketOrders })
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

    // This endpoint creates a pending order, not a confirmed payment. Use
    // pending-specific copy and wait for best-effort side effects to finish so
    // serverless request teardown cannot silently discard the notifications.
    const sideEffects = await Promise.allSettled([
      // Buyer notification + email
      insertNotification({
        userId: user.id,
        type: 'order',
        title: `Order request created: ${orderTitle}`,
        body: `Your order request for "${orderTitle}" (€${body.amount.toFixed(2)}) is pending payment. Check My Orders for its current status.`,
        link: `/orders/${order.id}`,
      }),
      sendEmail({
        type: 'order_placed',
        userId: user.id,
        payload: { orderTitle, amount: body.amount, orderId: order.id, recipientRole: 'pending_buyer', currency: body.currency ?? 'EUR' },
      }),
      // Seller notification + email
      insertNotification({
        userId: body.seller_id,
        type: 'order',
        title: `New order request: ${orderTitle}`,
        body: `A member started an order for "${orderTitle}" (€${body.amount.toFixed(2)}). Payment is pending; check My Orders before starting work.`,
        link: `/orders/${order.id}`,
      }),
      sendEmail({
        type: 'order_placed',
        userId: body.seller_id,
        payload: { orderTitle, amount: body.amount, orderId: order.id, recipientRole: 'pending_seller', currency: body.currency ?? 'EUR' },
      }),
    ])
    sideEffects.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error('[Orders POST] notification/email side effect failed:', { index, error: result.reason })
      }
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    console.error('[Orders POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
