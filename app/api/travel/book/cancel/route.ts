import { NextRequest, NextResponse } from 'next/server'
import { requireTravelMember } from '@/lib/travel/memberAuth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const member = await requireTravelMember()
    if (member.response) return member.response
    if (!member.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { supabase, user } = member

    const body = await req.json().catch(() => null) as { bookingId?: string } | null
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : ''
    if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })

    const { data: booking, error } = await supabase
      .from('travel_bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
    return NextResponse.json({ booking })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected travel cancellation error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
