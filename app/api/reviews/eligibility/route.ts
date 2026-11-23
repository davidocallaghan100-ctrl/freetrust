export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Returns one unreviewed, completed purchase for this listing, if any. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ eligibleOrder: null }, { status: 200 })

    const listingId = new URL(request.url).searchParams.get('listingId')
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 })

    const admin = createAdminClient()
    // Preserve FreeTrust's existing one-review-per-listing behavior while
    // adding order-bound proof of eligibility.
    const { data: existingListingReview, error: existingReviewError } = await admin.from('reviews')
      .select('id')
      .eq('reviewer_id', user.id)
      .eq('listing_id', listingId)
      .eq('target_type', 'seller')
      .maybeSingle()
    if (existingReviewError) return NextResponse.json({ error: 'Could not verify existing reviews' }, { status: 500 })
    if (existingListingReview) return NextResponse.json({ eligibleOrder: null })

    const [{ data: completedOrders, error: ordersError }, { data: completedItems, error: itemsError }] = await Promise.all([
      admin.from('orders')
        .select('id, buyer_id, seller_id, listing_id, created_at')
        .eq('buyer_id', user.id)
        .eq('listing_id', listingId)
        .eq('status', 'completed')
        .or('type.is.null,type.neq.product_basket')
        .order('created_at', { ascending: false }),
      admin.from('order_items')
        .select('id, order_id, buyer_id, seller_id, listing_id, delivery_status, completed_at')
        .eq('buyer_id', user.id)
        .eq('listing_id', listingId)
        .eq('delivery_status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }),
    ])

    if (ordersError || itemsError) {
      console.error('[GET /api/reviews/eligibility] order lookup failed', ordersError ?? itemsError)
      return NextResponse.json({ error: 'Could not verify completed purchases' }, { status: 500 })
    }

    const itemOrderIds = Array.from(new Set((completedItems ?? []).map(item => item.order_id)))
    const { data: basketOrders, error: basketOrdersError } = itemOrderIds.length
      ? await admin.from('orders').select('id, buyer_id, status, type').in('id', itemOrderIds)
      : { data: [] as Array<{ id: string; buyer_id: string; status: string; type: string }> , error: null }
    if (basketOrdersError) return NextResponse.json({ error: 'Could not verify completed basket items' }, { status: 500 })

    const basketById = new Map((basketOrders ?? []).map(order => [order.id, order]))
    const eligibleOrders = (completedOrders ?? []).map(order => ({
      order_id: order.id,
      order_item_id: null,
      reviewee_id: order.seller_id,
      completed_at: order.created_at,
    })).filter(order => order.reviewee_id)
    const eligibleItems = (completedItems ?? []).filter(item => {
      const parent = basketById.get(item.order_id)
      return !!parent
        && parent.type === 'product_basket'
        && ['paid', 'completed'].includes(parent.status)
        && parent.buyer_id === user.id
        && item.seller_id
    }).map(item => ({
      order_id: null,
      order_item_id: item.id,
      reviewee_id: item.seller_id,
      completed_at: item.completed_at,
    }))

    const candidates = [...eligibleOrders, ...eligibleItems]
      .sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime())
    if (!candidates.length) return NextResponse.json({ eligibleOrder: null })

    const orderIds = candidates.map(candidate => candidate.order_id).filter(Boolean) as string[]
    const orderItemIds = candidates.map(candidate => candidate.order_item_id).filter(Boolean) as string[]
    const [reviewedOrdersResult, reviewedItemsResult] = await Promise.all([
      orderIds.length
        ? admin.from('reviews').select('order_id').eq('reviewer_id', user.id).in('order_id', orderIds)
        : Promise.resolve({ data: [] as Array<{ order_id: string | null }>, error: null }),
      orderItemIds.length
        ? admin.from('reviews').select('order_item_id').eq('reviewer_id', user.id).in('order_item_id', orderItemIds)
        : Promise.resolve({ data: [] as Array<{ order_item_id: string | null }>, error: null }),
    ])
    if (reviewedOrdersResult.error || reviewedItemsResult.error) {
      return NextResponse.json({ error: 'Could not verify existing reviews' }, { status: 500 })
    }

    const reviewedOrderIds = new Set((reviewedOrdersResult.data ?? []).map(review => review.order_id))
    const reviewedItemIds = new Set((reviewedItemsResult.data ?? []).map(review => review.order_item_id))
    const eligibleOrder = candidates.find(candidate =>
      candidate.order_id ? !reviewedOrderIds.has(candidate.order_id) : !reviewedItemIds.has(candidate.order_item_id),
    ) ?? null

    return NextResponse.json({ eligibleOrder })
  } catch (error) {
    console.error('[GET /api/reviews/eligibility]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
