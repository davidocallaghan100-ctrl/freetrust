export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardTrust } from '@/lib/trust/award'
import { insertNotification } from '@/lib/notifications/insert'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'

interface RouteParams {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = params.id

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check already RSVPed
    const { data: existing } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already RSVPed' }, { status: 409 })
    }

    // If paid event, return Stripe checkout URL
    if (event.is_paid && event.ticket_price > 0) {
      // Use existing Stripe checkout pattern
      const checkoutRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
        body: JSON.stringify({ eventId, amount: event.ticket_price, type: 'event' }),
      })
      if (checkoutRes.ok) {
        const { url } = await checkoutRes.json() as { url: string }
        return NextResponse.json({ checkoutUrl: url })
      }
      // Fallback if checkout fails
      return NextResponse.json({ error: 'Checkout unavailable' }, { status: 500 })
    }

    // Free event — insert attendee directly
    const { error: insertError } = await supabase
      .from('event_attendees')
      .insert({ event_id: eventId, user_id: user.id })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Increment attendee count
    await supabase
      .from('events')
      .update({ attendee_count: (event.attendee_count || 0) + 1 })
      .eq('id', eventId)

    // Notify the event creator (skip if the RSVPer IS the creator)
    if (event.creator_id && event.creator_id !== user.id) {
      try {
        const { data: rsvper } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        await insertNotification({
          userId: event.creator_id as string,
          type: 'event_rsvp',
          title: `${(rsvper?.full_name as string | null) ?? 'Someone'} is attending ${event.title ?? 'your event'}`,
          body: 'Tap to see the full attendee list.',
          link: `/events/${eventId}`,
        })
      } catch (e) {
        console.error('[events/rsvp] notification failed:', e)
      }
    }

    // Award ₮ for RSVPing — free path only. Paid event RSVPs go
    // through the Stripe checkout flow which can award after
    // payment confirmation.
    const trustResult = await awardTrust({
      userId: user.id,
      amount: TRUST_REWARDS.RSVP_EVENT,
      type:   TRUST_LEDGER_TYPES.RSVP_EVENT,
      ref:    eventId,
      desc:   `RSVPed to: ${event.title ?? 'an event'}`,
    })

    return NextResponse.json({
      success: true,
      trustAwarded: trustResult.ok ? trustResult.amount : 0,
    })
  } catch (err) {
    console.error('[POST /api/events/[id]/rsvp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = params.id

    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Decrement attendee count
    const { data: event } = await supabase.from('events').select('attendee_count').eq('id', eventId).single()
    if (event) {
      await supabase.from('events').update({ attendee_count: Math.max(0, (event.attendee_count || 1) - 1) }).eq('id', eventId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/events/[id]/rsvp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
