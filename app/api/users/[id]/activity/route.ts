export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/users/[id]/activity?page=1&limit=20
// Returns a unified chronological feed of everything this user has created:
// listings, jobs, events, reviews left, articles, feed posts

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: userId } = params
    const { searchParams } = new URL(request.url)
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const admin = createAdminClient()

    // Fetch all content types in parallel
    const [
      jobsRes,
      listingsRes,
      eventsRes,
      articlesRes,
      reviewsRes,
    ] = await Promise.all([
      admin
        .from('jobs')
        .select('id, title, job_type, location_type, status, applicant_count, company_logo_url, created_at')
        .eq('poster_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('listings')
        .select('id, title, product_type, price, currency, status, avg_rating, review_count, images, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('events')
        .select('id, title, starts_at, venue_name, location_label, is_online, cover_image_url, attendee_count, created_at')
        .eq('creator_id', userId)
        .eq('is_platform_curated', false)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('articles')
        .select('id, title, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      admin
        .from('reviews')
        .select('id, rating, comment, reviewee_id, created_at, reviewee:profiles!reviewee_id(full_name)')
        .eq('reviewer_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    type ActivityItem = {
      id: string
      type: 'job' | 'listing' | 'event' | 'article' | 'review'
      title: string
      subtitle?: string
      description?: string
      image_url?: string | null
      created_at: string
      link: string
      meta?: string
      status?: string
    }

    const items: ActivityItem[] = []

    // Jobs
    for (const j of (jobsRes.data ?? [])) {
      items.push({
        id:         `job-${j.id}`,
        type:       'job',
        title:      (j.title as string) ?? 'Job posting',
        subtitle:   [j.job_type, j.location_type].filter(Boolean).join(' · '),
        image_url:  j.company_logo_url as string | null ?? null,
        created_at: j.created_at as string,
        link:       `/jobs/${j.id}`,
        meta:       `👥 ${(j.applicant_count as number) ?? 0} applicants`,
        status:     j.status as string,
      })
    }

    // Listings (services + products)
    for (const l of (listingsRes.data ?? [])) {
      const isService = l.product_type === 'service'
      const images = Array.isArray(l.images) ? l.images : []
      items.push({
        id:         `listing-${l.id}`,
        type:       'listing',
        title:      (l.title as string) ?? 'Listing',
        subtitle:   isService ? '🛠 Service' : '📦 Product',
        image_url:  images[0] ?? null,
        created_at: l.created_at as string,
        link:       `/services/${l.id}`,
        meta:       l.avg_rating && l.review_count
          ? `⭐ ${Number(l.avg_rating).toFixed(1)} · ${l.review_count} reviews`
          : `€${Number(l.price).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        status:     l.status as string,
      })
    }

    // Events (platform-curated events excluded — they appear on David's profile via is_platform_curated=false filter)
    for (const e of (eventsRes.data ?? [])) {
      const locationLabel = (e.location_label ?? e.venue_name) as string | null | undefined
      items.push({
        id:         `event-${e.id}`,
        type:       'event',
        title:      (e.title as string) ?? 'Event',
        subtitle:   e.is_online ? '🌐 Online' : `📍 ${locationLabel ?? 'In person'}`,
        image_url:  (e.cover_image_url as string | null) ?? null,
        created_at: e.created_at as string,
        link:       `/events/${e.id}`,
        meta:       `👥 ${(e.attendee_count as number) ?? 0} attending`,
      })
    }

    // Articles
    for (const a of (articlesRes.data ?? [])) {
      items.push({
        id:         `article-${a.id}`,
        type:       'article' as ActivityItem['type'],
        title:      (a.title as string) ?? 'Article',
        created_at: a.created_at as string,
        link:       `/articles/${a.id}`,
      })
    }

    // Reviews left by this user
    for (const r of (reviewsRes.data ?? [])) {
      const reviewee = r.reviewee as { full_name?: string } | null
      items.push({
        id:         `review-${r.id}`,
        type:       'review',
        title:      `Left a ${r.rating}★ review`,
        subtitle:   reviewee?.full_name ? `for ${reviewee.full_name}` : undefined,
        description: (r.comment as string | null)?.slice(0, 120) ?? undefined,
        created_at: r.created_at as string,
        link:       `/profile?id=${r.reviewee_id}`,
      })
    }

    // Sort merged list by date DESC
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const total   = items.length
    const offset  = (page - 1) * limit
    const paged   = items.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    return NextResponse.json({ items: paged, total, page, limit, hasMore })
  } catch (err) {
    console.error('[GET /api/users/[id]/activity]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
