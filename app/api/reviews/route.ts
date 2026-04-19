export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReviewReceivedEmail } from '@/lib/resend'
import { awardTrust } from '@/lib/trust/award'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'
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
        *,
        reviewer:profiles!reviewer_id(id, full_name, avatar_url, username),
        reviewee:profiles!reviewee_id(id, full_name, avatar_url, username)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (profileId) query = query.eq('reviewee_id', profileId)
    if (listingId) query = query.eq('listing_id', listingId)

    const { data: reviews, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ reviews: reviews ?? [], total: count ?? 0, page, limit })
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

    const body = await request.json()
    const {
      order_id, reviewee_id, listing_id, reviewer_role,
      rating_overall, rating_quality, rating_communication,
      rating_delivery, rating_clarity, rating_payment,
      rating_professionalism, content,
    } = body

    if (!reviewee_id || !reviewer_role || !rating_overall) {
      return NextResponse.json({ error: 'reviewee_id, reviewer_role and rating_overall are required' }, { status: 400 })
    }

    // Prevent duplicate review on same order
    if (order_id) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', order_id)
        .eq('reviewer_id', user.id)
        .single()
      if (existing) return NextResponse.json({ error: 'Already reviewed this order' }, { status: 409 })
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        order_id: order_id ?? null,
        reviewer_id: user.id,
        reviewee_id,
        listing_id: listing_id ?? null,
        reviewer_role,
        rating_overall,
        rating_quality: rating_quality ?? null,
        rating_communication: rating_communication ?? null,
        rating_delivery: rating_delivery ?? null,
        rating_clarity: rating_clarity ?? null,
        rating_payment: rating_payment ?? null,
        rating_professionalism: rating_professionalism ?? null,
        content: content?.slice(0, 1000) ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Award ₮ to BOTH parties — reviewer gets LEAVE_REVIEW for
    // taking the time to leave feedback, reviewee gets
    // RECEIVE_REVIEW for the reputation signal. Before this
    // commit the route called a `increment_trust` RPC that
    // doesn't exist anywhere (grep across supabase/migrations/
    // and lib/supabase/*.sql returns zero matches), so the
    // ledger insert succeeded but the balance update silently
    // failed with "function does not exist". The reviewee got
    // nothing at all. Both fixed by routing through the
    // standard awardTrust() helper + issue_trust RPC.
    if (!review.trust_issued) {
      await awardTrust({
        userId: user.id,
        amount: TRUST_REWARDS.LEAVE_REVIEW,
        type:   TRUST_LEDGER_TYPES.LEAVE_REVIEW,
        ref:    review.id,
        desc:   'Left a review',
      })
      await awardTrust({
        userId: reviewee_id,
        amount: TRUST_REWARDS.RECEIVE_REVIEW,
        type:   TRUST_LEDGER_TYPES.RECEIVE_REVIEW,
        ref:    review.id,
        desc:   'Received a review',
      })
      await supabase.from('reviews').update({ trust_issued: true }).eq('id', review.id)
    }

    // Update reviewee avg_rating + review_count
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating_overall')
      .eq('reviewee_id', reviewee_id)
    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((s, r) => s + r.rating_overall, 0) / allReviews.length
      await supabase.from('profiles')
        .update({ avg_rating: Math.round(avg * 100) / 100, review_count: allReviews.length })
        .eq('id', reviewee_id)
    }

    // Update listing avg_rating if applicable
    if (listing_id) {
      const { data: listingReviews } = await supabase
        .from('reviews')
        .select('rating_overall')
        .eq('listing_id', listing_id)
      if (listingReviews && listingReviews.length > 0) {
        const avg = listingReviews.reduce((s, r) => s + r.rating_overall, 0) / listingReviews.length
        await supabase.from('listings')
          .update({ avg_rating: Math.round(avg * 100) / 100, review_count: listingReviews.length })
          .eq('id', listing_id)
      }
    }

    // Send email notification to reviewee
    try {
      const { data: revieweeProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', reviewee_id)
        .single()
      const { data: reviewerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      const { data: authUser } = await supabase.auth.admin.getUserById(reviewee_id)
      if (authUser?.user?.email && revieweeProfile && reviewerProfile) {
        await sendReviewReceivedEmail(
          authUser.user.email,
          revieweeProfile.full_name ?? 'there',
          reviewerProfile.full_name ?? 'Someone',
          rating_overall,
          content?.slice(0, 120) ?? 'Left a review',
        )
      }

      // In-app notification — separate from the email so it lands
      // in the bell even if the email fails (e.g. user's mailbox
      // full, Resend outage).
      await insertNotification({
        userId: reviewee_id,
        type:   'review_received',
        title:  `${reviewerProfile?.full_name ?? 'Someone'} left you a ${rating_overall}-star review`,
        body:   content?.slice(0, 140) ?? null,
        link:   `/profile?id=${reviewee_id}`,
      })
    } catch { /* email/notification failure non-fatal */ }

    // Mark order as reviewed
    if (order_id) {
      const field = reviewer_role === 'buyer' ? 'buyer_reviewed' : 'seller_reviewed'
      await supabase.from('orders').update({ [field]: true }).eq('id', order_id)
    }

    return NextResponse.json({ review }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/reviews]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
