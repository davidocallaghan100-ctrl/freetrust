export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/communities/[slug]/events/[eventId]/rsvp — RSVP to event
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check not already RSVP'd
    const { data: existing } = await supabase
      .from('community_event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already RSVPed' }, { status: 400 })
    }

    const { error: insertError } = await supabase
      .from('community_event_attendees')
      .insert({ event_id: eventId, user_id: user.id })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Increment attendee count
    const { data: ev } = await supabase
      .from('community_events')
      .select('attendee_count')
      .eq('id', eventId)
      .single()
    const newCount = (ev?.attendee_count ?? 0) + 1
    await supabase
      .from('community_events')
      .update({ attendee_count: newCount })
      .eq('id', eventId)

    return NextResponse.json({ success: true, attendee_count: newCount })
  } catch (err) {
    console.error('[POST /rsvp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/communities/[slug]/events/[eventId]/rsvp — cancel RSVP
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('community_event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Decrement attendee count
    const { data: ev } = await supabase
      .from('community_events')
      .select('attendee_count')
      .eq('id', eventId)
      .single()
    const newCount = Math.max(0, (ev?.attendee_count ?? 1) - 1)
    await supabase
      .from('community_events')
      .update({ attendee_count: newCount })
      .eq('id', eventId)

    return NextResponse.json({ success: true, attendee_count: newCount })
  } catch (err) {
    console.error('[DELETE /rsvp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
