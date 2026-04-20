export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
        rating,
        comment,
        created_at,
        reviewer:profiles!reviewer_id(id, full_name, avatar_url, username),
        reviewee:profiles!reviewee_id(id, full_name, avatar_url, username)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (profileId) query = query.eq('reviewee_id', profileId)
    if (listingId) query = query.eq('listing_id', listingId)

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

    const body = await request.json()
    const {
      reviewee_id,
      listing_id,
      rating_overall, // client may send this
      rating,         // or this
      content,        // client may send this
      comment,        // or this
    } = body

    const finalRating = rating_overall ?? rating
    const finalComment = content ?? comment ?? null

    if (!reviewee_id || !finalRating) {
      return NextResponse.json({ error: 'reviewee_id and rating are required' }, { status: 400 })
    }
    if (finalRating < 1 || finalRating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 })
    }

    // Prevent duplicate review for same listing + reviewer
    if (listing_id) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('listing_id', listing_id)
        .eq('reviewer_id', user.id)
        .single()
      if (existing) return NextResponse.json({ error: 'You have already reviewed this listing' }, { status: 409 })
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        reviewer_id: user.id,
        reviewee_id,
        listing_id: listing_id ?? null,
        rating: finalRating,
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

    // In-app notification to reviewee
    try {
      const { data: reviewerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      await insertNotification({
        userId: reviewee_id,
        type:   'review_received',
        title:  `${reviewerProfile?.full_name ?? 'Someone'} left you a ${finalRating}-star review`,
        body:   finalComment?.slice(0, 140) ?? null,
        link:   `/profile?id=${reviewee_id}`,
      })
    } catch { /* notification failure is non-fatal */ }

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
