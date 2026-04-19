export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardTrust } from '@/lib/trust/award'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'

// ── API key auth for external event ingestion ────────────────────────────────
//
// Set EVENTS_API_KEY in Vercel → Project Settings → Environment Variables.
// External callers POST with:  x-api-key: <EVENTS_API_KEY>
// When authenticated this way, events are posted under the admin (system) account.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/events — public list with location-aware filtering
//
// Query params:
//   ?upcoming=true         Only events with starts_at >= now
//   ?category=…            Filter by category
//   ?country=IE            ISO country filter
//   ?city=Cork             City (ilike)
//   ?lat=&lng=&radius_km=  Proximity filter (haversine in JS)
//   ?online_only=true      Only online events
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const upcoming = searchParams.get('upcoming') === 'true'
    const category = searchParams.get('category')

    const country    = searchParams.get('country')
    const city       = searchParams.get('city')
    const latParam   = searchParams.get('lat')
    const lngParam   = searchParams.get('lng')
    const radiusParam= searchParams.get('radius_km')
    const onlineOnly = searchParams.get('online_only') === 'true'

    const lat = latParam ? Number(latParam) : null
    const lng = lngParam ? Number(lngParam) : null
    const radius = radiusParam ? Number(radiusParam) : 0
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng)

    let query = supabase
      .from('events')
      .select(`*, profiles:creator_id(id, full_name, avatar_url)`)
      .eq('status', 'published')
      .order('starts_at', { ascending: true })

    if (upcoming)   query = query.gte('starts_at', new Date().toISOString())
    if (category)   query = query.eq('category', category)
    if (country)    query = query.eq('country', country.toUpperCase())
    if (city)       query = query.ilike('city', `%${city}%`)
    if (onlineOnly) query = query.eq('is_online', true)

    const { data, error } = await query.limit(200)

    if (error) {
      // Table may not exist yet — return empty
      return NextResponse.json({ events: [] })
    }

    let events = data ?? []
    if (hasGeo && lat !== null && lng !== null) {
      events = events.map((e: Record<string, unknown>) => {
        const eLat = typeof e.latitude === 'number' ? e.latitude : null
        const eLng = typeof e.longitude === 'number' ? e.longitude : null
        if (eLat == null || eLng == null) return { ...e, distance_km: null }
        const dLat = ((eLat - lat) * Math.PI) / 180
        const dLng = ((eLng - lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) * Math.cos((eLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return { ...e, distance_km: dist }
      })
      if (radius > 0) {
        events = events.filter((e: Record<string, unknown>) => {
          if (e.is_online) return true
          const d = e.distance_km
          return typeof d === 'number' && d <= radius
        })
      }
    }

    return NextResponse.json({ events })
  } catch (err) {
    console.error('[GET /api/events]', err)
    return NextResponse.json({ events: [] })
  }
}

// POST /api/events — create or update an event
//
// Auth: Supabase JWT (Authorization: Bearer <token>)    — creator_id = authenticated user
//   OR: API key (x-api-key: <EVENTS_API_KEY>)           — creator_id = admin system account
//
// Upsert behaviour: if external_id + external_source are provided and a
// matching row already exists, the event is updated (dedup for repeated syncs).
// Returns { event, created: true } on insert, { event, created: false } on update.
//
// Required: title, starts_at
// Optional: all other event columns
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient()

    // ── Auth: check JWT first, then API key ───────────────────────────────
    let creatorId: string | null = null
    let isApiKeyAuth = false

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      creatorId = user.id
    } else {
      const apiKey = request.headers.get('x-api-key')
      const expectedKey = process.env.EVENTS_API_KEY
      if (expectedKey && apiKey && apiKey === expectedKey) {
        const { data: adminProfile } = await admin
          .from('profiles')
          .select('id')
          .eq('email', 'davidocallaghan100@gmail.com')
          .maybeSingle()
        if (adminProfile?.id) {
          creatorId = adminProfile.id
          isApiKeyAuth = true
        }
      }
    }

    if (!creatorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      // Required
      title,
      starts_at,
      // Standard event fields
      description,
      category,
      cover_image_url,
      tags,
      ends_at,
      timezone,
      is_online,
      venue_name,
      venue_address,
      meeting_url,
      is_paid,
      ticket_price,
      ticket_price_eur,
      currency_code,
      max_attendees,
      organiser_name,
      organiser_bio,
      country,
      region,
      city,
      latitude,
      longitude,
      location_label,
      // Upsert / dedup keys
      external_id,
      external_source,
      external_url,
      // UI-style fields (from the existing form-based path)
      mode,
      startDate,
      startTime,
      endDate,
      endTime,
      venue,
      address,
      onlineLink,
      onlinePlatform: _onlinePlatform,
      coverImage,
      maxAttendees,
      tickets,
      visibility: _visibility,
      organiserName,
      organiserBio,
    } = body

    // Resolve starts_at — accept ISO string directly OR the legacy form format
    const resolvedStartsAt: string | null =
      starts_at ?? (startDate && startTime ? new Date(`${startDate}T${startTime}`).toISOString() : null)
    const resolvedEndsAt: string | null =
      ends_at ?? (endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : null)

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!resolvedStartsAt) {
      return NextResponse.json({ error: 'starts_at is required' }, { status: 400 })
    }

    // Resolve legacy form-style fields
    const resolvedIsOnline  = is_online ?? (mode === 'online' || mode === 'hybrid')
    const resolvedIsInPerson = mode ? (mode === 'in-person' || mode === 'hybrid') : !resolvedIsOnline
    const hasPaidTicket = is_paid ?? (tickets?.some((t: { free: boolean }) => !t.free) ?? false)
    const resolvedTicketPrice = ticket_price
      ?? (hasPaidTicket ? tickets?.find((t: { free: boolean; price: number }) => !t.free)?.price ?? 0 : 0)
    const resolvedVenueName   = venue_name ?? (resolvedIsInPerson ? venue : null) ?? null
    const resolvedVenueAddr   = venue_address
      ?? (resolvedIsInPerson ? [address, city, country].filter(Boolean).join(', ') || null : null)
    const resolvedMaxAttendees = max_attendees ?? (maxAttendees ? parseInt(maxAttendees) : null)
    const resolvedCoverImage  = cover_image_url ?? coverImage ?? null
    const resolvedOrgName     = organiser_name ?? organiserName ?? null
    const resolvedOrgBio      = organiser_bio ?? organiserBio ?? null
    const resolvedMeetingUrl  = meeting_url ?? (resolvedIsOnline ? onlineLink : null) ?? null

    const eventData = {
      creator_id:       creatorId,
      title:            title.trim(),
      description:      description?.trim() || null,
      category:         category || null,
      cover_image_url:  resolvedCoverImage,
      tags:             Array.isArray(tags) ? tags : [],
      status:           'published' as const,
      starts_at:        resolvedStartsAt,
      ends_at:          resolvedEndsAt,
      timezone:         timezone || 'UTC',
      is_online:        resolvedIsOnline,
      venue_name:       resolvedVenueName,
      venue_address:    resolvedVenueAddr,
      meeting_url:      resolvedMeetingUrl,
      is_paid:          hasPaidTicket,
      ticket_price:     resolvedTicketPrice,
      ticket_price_eur: ticket_price_eur ?? (currency_code === 'EUR' ? resolvedTicketPrice : 0),
      currency_code:    currency_code ?? 'EUR',
      max_attendees:    resolvedMaxAttendees,
      attendee_count:   0,
      organiser_name:   resolvedOrgName,
      organiser_bio:    resolvedOrgBio,
      country:          country ?? null,
      region:           region ?? null,
      city:             city ?? null,
      latitude:         typeof latitude === 'number' ? latitude : null,
      longitude:        typeof longitude === 'number' ? longitude : null,
      location_label:   location_label ?? null,
      external_id:      external_id ?? null,
      external_source:  external_source ?? null,
      external_url:     external_url ?? null,
    }

    // ── Upsert logic ─────────────────────────────────────────────────────
    // If external_id + external_source are provided, check for existing row
    let existingId: string | null = null
    if (external_id && external_source) {
      const { data: existing } = await admin
        .from('events')
        .select('id')
        .eq('external_id', external_id)
        .eq('external_source', external_source)
        .maybeSingle()
      existingId = existing?.id ?? null
    }

    let event: Record<string, unknown> | null = null
    let created = true

    if (existingId) {
      // Update existing — don't overwrite creator_id
      const { creator_id: _skip, attendee_count: _skip2, ...updatePayload } = eventData
      void _skip; void _skip2
      const { data: updated, error: updateErr } = await admin
        .from('events')
        .update(updatePayload)
        .eq('id', existingId)
        .select()
        .single()
      if (updateErr) {
        console.error('[POST /api/events] update error:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
      event = updated as Record<string, unknown>
      created = false
    } else {
      const { data: inserted, error: insertErr } = await admin
        .from('events')
        .insert(eventData)
        .select()
        .single()
      if (insertErr) {
        console.error('[POST /api/events] insert error:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
      event = inserted as Record<string, unknown>
      created = true
    }

    // Award ₮ for creating an event — only on inserts, not updates; skip for API key posts
    let trustAwarded = 0
    if (created && !isApiKeyAuth) {
      const trustResult = await awardTrust({
        userId: creatorId,
        amount: TRUST_REWARDS.CREATE_EVENT,
        type:   TRUST_LEDGER_TYPES.CREATE_EVENT,
        ref:    event?.id as string ?? null,
        desc:   `Hosted event: ${title}`,
      })
      trustAwarded = trustResult.ok ? trustResult.amount : 0
    }

    return NextResponse.json(
      { event, created, trustAwarded },
      { status: created ? 201 : 200 },
    )
  } catch (err) {
    console.error('[POST /api/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
