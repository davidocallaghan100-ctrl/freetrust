import { NextRequest, NextResponse } from 'next/server'
import { requireTravelMember } from '@/lib/travel/memberAuth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function bookingConfig() {
  return {
    key: process.env.RAPIDAPI_KEY || process.env.BOOKING_RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY,
    host: process.env.BOOKING_API_HOST || process.env.NEXT_PUBLIC_BOOKING_API_HOST || 'booking-com15.p.rapidapi.com',
  }
}

function failure(message: string, status = 500) {
  return NextResponse.json({ error: message, status }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const member = await requireTravelMember()
    if (member.response) return member.response

    const { searchParams } = req.nextUrl
    const destId = searchParams.get('dest_id')?.trim()
    if (!destId) return failure('dest_id is required', 400)

    const { key, host } = bookingConfig()
    if (!key || key === 'your_rapidapi_key_here') return failure('RapidAPI Booking.com key is not configured', 500)

    const url = new URL(`https://${host}/api/v1/hotels/searchHotels`)
    ;['dest_id', 'search_type', 'arrival_date', 'departure_date', 'adults', 'room_qty', 'children_age'].forEach(param => {
      const value = searchParams.get(param)
      if (value) url.searchParams.set(param, value)
    })
    if (!url.searchParams.has('search_type')) url.searchParams.set('search_type', 'CITY')
    url.searchParams.set('currency_code', 'EUR')
    url.searchParams.set('languagecode', 'en-us')

    const res = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
      },
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) return failure(data?.message || data?.error || 'Booking.com hotel search failed', res.status)

    const hotels = Array.isArray(data?.data?.hotels)
      ? data.data.hotels
      : Array.isArray(data?.data?.result)
        ? data.data.result
        : Array.isArray(data?.data)
          ? data.data
          : []

    return NextResponse.json({ hotels })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected hotel search error'
    return failure(message, 500)
  }
}
