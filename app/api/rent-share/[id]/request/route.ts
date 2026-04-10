export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listing_id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { from_date, to_date, message } = body

    if (!from_date || !to_date) {
      return NextResponse.json({ error: 'from_date and to_date are required' }, { status: 400 })
    }
    if (new Date(from_date) > new Date(to_date)) {
      return NextResponse.json({ error: 'from_date must be before to_date' }, { status: 400 })
    }

    // Verify listing exists and is active
    const { data: listing, error: listErr } = await supabase
      .from('rent_share_listings')
      .select('id, user_id, status')
      .eq('id', listing_id)
      .single()

    if (listErr || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    if (listing.status !== 'active') {
      return NextResponse.json({ error: 'Listing is not available' }, { status: 409 })
    }
    if (listing.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot request your own listing' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('rent_share_requests')
      .insert({
        listing_id,
        requester_id: user.id,
        from_date,
        to_date,
        message: message?.trim() ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/rent-share/[id]/request]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ request: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/rent-share/[id]/request]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
