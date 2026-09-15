export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

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

    if (!isDateOnly(from_date) || !isDateOnly(to_date)) {
      return NextResponse.json({ error: 'from_date and to_date are required' }, { status: 400 })
    }
    if (from_date >= to_date) {
      return NextResponse.json({ error: 'to_date must be after from_date' }, { status: 400 })
    }
    if (from_date < todayDateOnly()) {
      return NextResponse.json({ error: 'Bookings cannot start in the past' }, { status: 400 })
    }

    // Verify listing exists and is active
    const { data: listing, error: listErr } = await supabase
      .from('rent_share_listings')
      .select('id, user_id, status, title, available_from, available_to')
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
    if (listing.available_from && from_date < listing.available_from) {
      return NextResponse.json({ error: `This listing is available from ${listing.available_from}` }, { status: 409 })
    }
    if (listing.available_to && to_date > listing.available_to) {
      return NextResponse.json({ error: `This listing is available until ${listing.available_to}` }, { status: 409 })
    }

    // Avoid duplicate requests from the same renter and overlapping confirmed
    // bookings for the listing. The admin client is used for the overlap check
    // because the public request SELECT policy intentionally only exposes a
    // renter's own requests and requests for the listing owner.
    const admin = createAdminClient()
    const { data: existingRequests, error: existingErr } = await admin
      .from('rent_share_requests')
      .select('id, requester_id, from_date, to_date, status')
      .eq('listing_id', listing_id)
      .in('status', ['pending', 'approved', 'completed'])

    if (existingErr) {
      console.error('[POST /api/rent-share/[id]/request] overlap query error:', existingErr)
      return NextResponse.json({ error: 'Could not verify booking availability' }, { status: 500 })
    }

    const duplicate = (existingRequests ?? []).some(existing =>
      existing.requester_id === user.id && existing.from_date === from_date && existing.to_date === to_date
    )
    if (duplicate) {
      return NextResponse.json({ error: 'You already have a request for these dates' }, { status: 409 })
    }

    const overlaps = (existingRequests ?? []).some(existing =>
      existing.status !== 'pending' && existing.from_date < to_date && from_date < existing.to_date
    )
    if (overlaps) {
      return NextResponse.json({ error: 'Those dates are already booked or being requested' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('rent_share_requests')
      .insert({
        listing_id,
        requester_id: user.id,
        from_date,
        to_date,
        message: typeof message === 'string' ? message.trim().slice(0, 1000) || null : null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/rent-share/[id]/request]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify the listing owner (non-critical, never throws)
    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    await insertNotification({
      userId: listing.user_id,
      type: 'rent_request',
      title: `🏠 New booking request for "${listing.title}"`,
      body: `${requesterProfile?.full_name ?? 'Someone'} requested ${from_date} → ${to_date}.`,
      link: '/gig-economy?tab=bookings',
    })

    return NextResponse.json({ request: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/rent-share/[id]/request]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
