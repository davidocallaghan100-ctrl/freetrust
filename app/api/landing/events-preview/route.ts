import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { REAL_EVENT_SOURCE_FILTER } from '@/lib/dataIntegrity'
import { eventPosterDataUri, isUsableEventImage } from '@/lib/events/display'
import { normalizeEventCategory } from '@/lib/events/categories'

export const dynamic = 'force-dynamic'

// GET /api/landing/events-preview?after=<ISO>&limit=4
// Returns the next N upcoming published events for the landing page strip.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after') ?? new Date().toISOString()
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '4'), 8)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('events')
      .select('id, title, starts_at, cover_image_url, is_online, location_label, venue_name, city, country, is_paid, ticket_price, currency_code, category, attendee_count')
      .eq('status', 'published')
      .or(REAL_EVENT_SOURCE_FILTER)
      .gte('starts_at', after)
      .order('starts_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[landing/events-preview]', error)
      return NextResponse.json([], { status: 200 })
    }

    const normalized = (data ?? []).map((event) => ({
      ...event,
      category: normalizeEventCategory(event.category, event.title),
      cover_image_url: isUsableEventImage(event.cover_image_url)
        ? event.cover_image_url
        : eventPosterDataUri({
            title: event.title,
            category: event.category,
            startsAt: event.starts_at,
            location: event.venue_name ?? event.location_label ?? [event.city, event.country].filter(Boolean).join(', '),
          }),
    }))

    return NextResponse.json(normalized, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (err) {
    console.error('[landing/events-preview] unexpected error:', err)
    return NextResponse.json([], { status: 200 })
  }
}
