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

    const query = req.nextUrl.searchParams.get('query')?.trim()
    if (!query) return failure('query is required', 400)

    const { key, host } = bookingConfig()
    if (!key || key === 'your_rapidapi_key_here') return failure('Travel partner search is not configured', 500)

    const url = new URL(`https://${host}/api/v1/hotels/searchDestination`)
    url.searchParams.set('query', query)

    const res = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
      },
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) return failure(data?.message || data?.error || 'Travel partner destination search failed', res.status)

    const destinations = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
    return NextResponse.json({ destinations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected destination search error'
    return failure(message, 500)
  }
}
