export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/listings/[id]/reviews
// Returns only reviews from verified FreeTrust buyers who completed a purchase of this listing.
// We join reviews with orders to confirm: orders.listing_id = listing.id AND orders.buyer_id = reviews.reviewer_id AND orders.status = 'completed'
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params
    if (!listingId) return NextResponse.json({ reviews: [], total: 0 })

    const supabase = createAdminClient()

    // Fetch reviews for this listing that have a verified completed order
    // Strategy: fetch all reviews for this listing, then filter by checking orders
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        id,
        reviewer_id,
        rating_overall,
        content,
        created_at,
        reviewer:profiles!reviewer_id(id, full_name, avatar_url)
      `)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[reviews] fetch error', error)
      return NextResponse.json({ reviews: [], total: 0 })
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ reviews: [], total: 0 })
    }

    // For each review, verify the reviewer has a completed order for this listing
    const reviewerIds = reviews.map((r: Record<string, unknown>) => r.reviewer_id as string)

    const { data: completedOrders } = await supabase
      .from('orders')
      .select('buyer_id, listing_id')
      .eq('listing_id', listingId)
      .eq('status', 'completed')
      .in('buyer_id', reviewerIds)

    const verifiedBuyerIds = new Set(
      (completedOrders ?? []).map((o: Record<string, unknown>) => o.buyer_id as string)
    )

    // Only return reviews from verified buyers
    const verifiedReviews = reviews
      .filter((r: Record<string, unknown>) => verifiedBuyerIds.has(r.reviewer_id as string))
      .map((r: Record<string, unknown>) => {
        const reviewer = r.reviewer as Record<string, unknown> | null
        return {
          id: r.id,
          rating: r.rating_overall,
          comment: r.content,
          created_at: r.created_at,
          verified_buyer: true,
          reviewer: {
            id: reviewer?.id ?? '',
            full_name: (reviewer?.full_name as string) || 'FreeTrust Member',
            avatar_url: (reviewer?.avatar_url as string) || null,
          },
        }
      })

    // Compute avg rating from verified reviews only
    const avgRating =
      verifiedReviews.length > 0
        ? verifiedReviews.reduce((s: number, r) => s + ((r.rating as number) ?? 0), 0) /
          verifiedReviews.length
        : 0

    return NextResponse.json({
      reviews: verifiedReviews,
      total: verifiedReviews.length,
      avgRating: Math.round(avgRating * 10) / 10,
    })
  } catch (err) {
    console.error('[GET /api/listings/[id]/reviews]', err)
    return NextResponse.json({ reviews: [], total: 0 })
  }
}
