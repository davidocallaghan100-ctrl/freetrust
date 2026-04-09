export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const upcoming = searchParams.get('upcoming') === 'true'
    const category = searchParams.get('category')

    let query = supabase
      .from('events')
      .select(`*, profiles:creator_id(id, full_name, avatar_url)`)
      .eq('status', 'published')
      .order('starts_at', { ascending: true })

    if (upcoming) {
      query = query.gte('starts_at', new Date().toISOString())
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query.limit(50)

    if (error) {
      // Table may not exist yet — return empty
      return NextResponse.json({ events: [] })
    }

    return NextResponse.json({ events: data ?? [] })
  } catch (err) {
    console.error('[GET /api/events]', err)
    return NextResponse.json({ events: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title, description, category, mode, startDate, startTime, endDate, endTime,
      timezone, venue, address, city, country, onlineLink, onlinePlatform,
      coverImage, maxAttendees, tickets, tags, visibility, organiserName, organiserBio,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const startsAt = startDate && startTime ? new Date(`${startDate}T${startTime}`).toISOString() : null
    const endsAt = endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : null

    const isOnline = mode === 'online' || mode === 'hybrid'
    const isInPerson = mode === 'in-person' || mode === 'hybrid'
    const hasPaidTicket = tickets?.some((t: { free: boolean }) => !t.free)
    const ticketPrice = hasPaidTicket ? tickets?.find((t: { free: boolean; price: number }) => !t.free)?.price : 0

    const eventData = {
      creator_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      category: category || null,
      is_online: isOnline,
      venue_name: isInPerson ? venue : null,
      venue_address: isInPerson ? [address, city, country].filter(Boolean).join(', ') : null,
      meeting_url: isOnline ? onlineLink : null,
      is_paid: hasPaidTicket,
      ticket_price: ticketPrice || 0,
      max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
      cover_image_url: coverImage || null,
      tags: tags || [],
      status: 'published',
      attendee_count: 0,
      starts_at: startsAt,
      ends_at: endsAt,
      timezone: timezone || 'UTC',
      organiser_name: organiserName || null,
      organiser_bio: organiserBio || null,
    }

    const { data: event, error: insertError } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/events] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Award ₮15 Trust for hosting
    try {
      await supabase.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount: 15,
        p_type: 'event_hosted',
        p_ref: event.id,
        p_desc: `Hosted event: ${title}`,
      })
    } catch (trustErr) {
      console.warn('[POST /api/events] trust award failed:', trustErr)
    }

    return NextResponse.json({ event, trust_earned: 15 })
  } catch (err) {
    console.error('[POST /api/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
