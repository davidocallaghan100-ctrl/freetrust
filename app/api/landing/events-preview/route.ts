import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      .select('id, title, starts_at, is_online, location_label, venue_name, city, is_paid, ticket_price, currency_code, category, attendee_count')
      .eq('status', 'published')
      .gte('starts_at', after)
      .order('starts_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[landing/events-preview]', error)
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[landing/events-preview] unexpected error:', err)
    return NextResponse.json([], { status: 200 })
  }
}
