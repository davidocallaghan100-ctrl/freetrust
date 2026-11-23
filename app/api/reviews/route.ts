export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'

// GET /api/reviews?profileId=&listingId=&page=
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const listingId = searchParams.get('listingId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = 20
    const offset = (page - 1) * limit

    let query = supabase
      .from('reviews')
      .select(`
        id,
        listing_id,
        reviewer_id,
        reviewee_id,
        target_type,
        rating,
        comment,
        created_at,
        reviewer:profiles!reviewer_id(id, full_name, avatar_url, username),
        reviewee:profiles!reviewee_id(id, full_name, avatar_url, username)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (profileId) query = query.eq('reviewee_id', profileId)
    if (listingId) query = query.eq('listing_id', listingId).eq('target_type', 'seller')

    const { data: reviews, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Normalise to the shape ReviewsSection expects:
    // rating_overall → rating, content → comment
    const normalised = (reviews ?? []).map(r => ({
      ...r,
      rating_overall: r.rating,
      content: r.comment,
    }))

    return NextResponse.json({ reviews: normalised, total: count ?? 0, page, limit })
  } catch (err) {
    console.error('[GET /api/reviews]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/reviews — submit a review
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid review payload' }, { status: 400 })
    const {
      reviewee_id,
      listing_id,
      order_id,
      order_item_id,
      rating_overall, // client may send this
      rating,         // or this
      content,        // client may send this
      comment,        // or this
    } = body

    const finalRating = rating_overall ?? rating
    const finalComment = content ?? comment ?? null

    if (!reviewee_id || !listing_id || !finalRating || (!!order_id === !!order_item_id)) {
      return NextResponse.json({ error: 'A listing, rating, reviewee, and exactly one completed order reference are required' }, { status: 400 })
    }
    const numericRating = Number(finalRating)
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 })
    }
    if (finalComment != null && typeof finalComment !== 'string') {
      return NextResponse.json({ error: 'comment must be text' }, { status: 400 })
    }

    const admin = createAdminClient()
    let eligible = false
    if (order_id) {
      const { data: order } = await admin
        .from('orders')
        .select('id, buyer_id, seller_id, listing_id, status, type')
        .eq('id', order_id)
        .maybeSingle()
      eligible = !!order
        && order.status === 'completed'
        && order.type !== 'product_basket'
        && order.buyer_id === user.id
        && order.seller_id === reviewee_id
        && order.listing_id === listing_id
    } else if (order_item_id) {
      const { data: item } = await admin
        .from('order_items')
        .select('id, order_id, buyer_id, seller_id, listing_id, delivery_status, completed_at')
        .eq('id', order_item_id)
        .maybeSingle()
      if (item) {
        const { data: parent } = await admin
          .from('orders')
          .select('id, buyer_id, status, type')
          .eq('id', item.order_id)
          .maybeSingle()
        eligible = !!parent
          && parent.type === 'product_basket'
          && ['paid', 'completed'].includes(parent.status)
          && item.buyer_id === user.id
          && item.seller_id === reviewee_id
          && item.listing_id === listing_id
          && item.delivery_status === 'completed'
          && !!item.completed_at
      }
    }
    if (!eligible) return NextResponse.json({ error: 'Reviews are available only to the buyer after a valid order or basket item is completed' }, { status: 403 })

    const { data: existingListingReview, error: existingListingError } = await admin.from('reviews')
      .select('id')
      .eq('listing_id', listing_id)
      .eq('reviewer_id', user.id)
      .eq('target_type', 'seller')
      .maybeSingle()
    if (existingListingError) return NextResponse.json({ error: 'Could not verify existing reviews' }, { status: 500 })
    if (existingListingReview) return NextResponse.json({ error: 'You have already reviewed this listing' }, { status: 409 })

    const duplicateQuery = admin.from('reviews').select('id').eq('reviewer_id', user.id)
    const { data: existing, error: duplicateError } = order_id
      ? await duplicateQuery.eq('order_id', order_id).maybeSingle()
      : await duplicateQuery.eq('order_item_id', order_item_id).maybeSingle()
    if (duplicateError) return NextResponse.json({ error: 'Could not verify review eligibility' }, { status: 500 })
    if (existing) return NextResponse.json({ error: 'You have already reviewed this completed order' }, { status: 409 })

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        reviewer_id: user.id,
        reviewee_id,
        listing_id,
        target_type: 'seller',
        order_id: order_id ?? null,
        order_item_id: order_item_id ?? null,
        rating: numericRating,
        comment: finalComment?.slice(0, 1000) ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update reviewee avg_rating + review_count on their profile
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', reviewee_id)
    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length
      await supabase.from('profiles')
        .update({ avg_rating: Math.round(avg * 100) / 100, review_count: allReviews.length })
        .eq('id', reviewee_id)
    }

    // Update listing avg_rating if applicable
    if (listing_id) {
      const { data: listingReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('listing_id', listing_id)
      if (listingReviews && listingReviews.length > 0) {
        const avg = listingReviews.reduce((s, r) => s + r.rating, 0) / listingReviews.length
        await supabase.from('listings')
          .update({ avg_rating: Math.round(avg * 100) / 100, review_count: listingReviews.length })
          .eq('id', listing_id)
        void supabase.rpc('recalculate_listing_quality', { p_listing_id: listing_id })
      }
    }

    // In-app notification to reviewee — fire-and-forget so it never blocks the response
    void (async () => {
      try {
        const { data: reviewerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        await insertNotification({
          userId: reviewee_id,
          type:   'review_received',
          title:  `${reviewerProfile?.full_name ?? 'Someone'} left you a ${numericRating}-star review`,
          body:   finalComment?.slice(0, 140) ?? null,
          link:   `/profile?id=${reviewee_id}`,
        })
      } catch { /* notification failure is non-fatal */ }
    })()

    // Return with normalised fields so client gets rating_overall
    return NextResponse.json({
      review: {
        ...review,
        rating_overall: review.rating,
        content: review.comment,
      }
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/reviews]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
