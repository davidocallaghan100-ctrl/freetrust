import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTravelMember } from '@/lib/travel/memberAuth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type TravelBookingBody = {
  searchId?: string | null
  bookingType?: 'flight' | 'accommodation' | 'bundle'
  externalId?: string | null
  destinationCountry?: string | null
  destinationCity?: string | null
  propertyName?: string | null
  flightNumber?: string | null
  airline?: string | null
  priceEur?: number | null
  currency?: string | null
  checkIn?: string | null
  checkOut?: string | null
  departureDate?: string | null
  returnDate?: string | null
  adults?: number | null
  rooms?: number | null
  affiliateUrl?: string | null
}

const REWARDS = { accommodation: 25, flight: 20, bundle: 50 } as const

export async function POST(req: NextRequest) {
  try {
    const member = await requireTravelMember()
    if (member.response) return member.response
    if (!member.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { supabase, user } = member

    const body = await req.json().catch(() => null) as TravelBookingBody | null
    const bookingType = body?.bookingType
    if (!bookingType || !['flight', 'accommodation', 'bundle'].includes(bookingType)) {
      return NextResponse.json({ error: 'bookingType must be flight, accommodation or bundle' }, { status: 400 })
    }
    if (!body?.affiliateUrl) return NextResponse.json({ error: 'affiliateUrl is required' }, { status: 400 })

    const trustAmount = REWARDS[bookingType]

    const { data: booking, error: bookingError } = await supabase
      .from('travel_bookings')
      .insert({
        user_id: user.id,
        search_id: body.searchId ?? null,
        booking_type: bookingType,
        external_id: body.externalId ?? null,
        provider: 'booking.com',
        destination_country: body.destinationCountry ?? null,
        destination_city: body.destinationCity ?? null,
        property_name: body.propertyName ?? null,
        flight_number: body.flightNumber ?? null,
        airline: body.airline ?? null,
        price_eur: typeof body.priceEur === 'number' ? body.priceEur : null,
        currency: body.currency ?? 'EUR',
        check_in: body.checkIn ?? null,
        check_out: body.checkOut ?? null,
        departure_date: body.departureDate ?? null,
        return_date: body.returnDate ?? null,
        adults: body.adults ?? 1,
        rooms: body.rooms ?? 1,
        status: 'pending',
        affiliate_url: body.affiliateUrl,
        trust_coins_earned: trustAmount,
      })
      .select('*')
      .single()

    if (bookingError) return NextResponse.json({ error: bookingError.message }, { status: 500 })

    const admin = createAdminClient()
    const { error: rpcError } = await admin.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount: trustAmount,
      p_type: `travel_${bookingType}_click`,
      p_ref: booking.id,
      p_desc: `Travel ${bookingType} booking click`,
    })

    if (rpcError) {
      console.error('[travel/book] issue_trust RPC failed:', {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
        bookingId: booking.id,
      })
      return NextResponse.json({ booking, trustAwarded: 0, trustError: rpcError.message }, { status: 200 })
    }

    return NextResponse.json({ booking, trustAwarded: trustAmount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected travel booking error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
