export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/cron/sync-eventbrite
// Runs daily at 03:00 UTC (see vercel.json).
// Pulls live events from the Eventbrite org and upserts them into
// public.events. Uses the internal sync endpoint logic directly
// (duplicated here to avoid an internal HTTP call).
//
// Auth: Vercel Cron secret header.

interface MappedRow {
  creator_id: string; title: string; description: string | null; category: string | null
  cover_image_url: string | null; tags: string[]; status: 'published'
  starts_at: string | null; ends_at: string | null; timezone: string; is_online: boolean
  venue_name: string | null; venue_address: string | null; meeting_url: null
  is_paid: boolean; ticket_price: number; ticket_price_eur: number; currency_code: string
  max_attendees: null; attendee_count: number; organiser_name: null; organiser_bio: null
  country: string | null; region: string | null; city: string | null
  latitude: number | null; longitude: number | null; location_label: string | null
  external_id: string; external_source: 'eventbrite'; external_url: string | null
}

interface EventbriteEvent {
  id: string
  name: { text: string | null } | null
  description: { text: string | null } | null
  url: string | null
  start: { timezone: string | null; utc: string | null } | null
  end:   { timezone: string | null; utc: string | null } | null
  online_event: boolean
  is_free: boolean
  currency: string | null
  status: string
  logo: { url: string | null; original?: { url: string | null } | null } | null
  venue: {
    name: string | null
    address: {
      address_1?: string | null
      city?: string | null
      region?: string | null
      country?: string | null
      latitude?: string | null
      longitude?: string | null
      localized_address_display?: string | null
    } | null
  } | null
  category: { name: string | null; short_name: string | null } | null
  ticket_availability: {
    minimum_ticket_price?: { major_value: string | null } | null
  } | null
}

async function fetchEvents(token: string, orgId: string): Promise<EventbriteEvent[]> {
  const all: EventbriteEvent[] = []
  let continuation: string | null = null

  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      status: 'live',
      expand: 'logo,venue,category,ticket_availability',
      order_by: 'start_asc',
      page_size: '50',
    })
    if (continuation) params.set('continuation', continuation)

    const res = await fetch(
      `https://www.eventbriteapi.com/v3/organizations/${orgId}/events/?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    if (!res.ok) break

    const data = await res.json()
    all.push(...(data.events ?? []))
    if (!data.pagination?.has_more_items) break
    continuation = data.pagination?.continuation ?? null
    if (!continuation) break
  }
  return all
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = process.env.EVENTBRITE_PRIVATE_TOKEN
  const orgId = process.env.EVENTBRITE_ORG_ID
  if (!token || !orgId) {
    console.log('[cron/sync-eventbrite] EVENTBRITE_PRIVATE_TOKEN or EVENTBRITE_ORG_ID not set — skipping')
    return NextResponse.json({ skipped: true, reason: 'env vars not set' })
  }

  const startedAt = Date.now()

  // Get the admin user id to use as creator_id
  const admin = createAdminClient()
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', 'davidocallaghan100@gmail.com')
    .maybeSingle()
  const creatorId = adminProfile?.id
  if (!creatorId) {
    return NextResponse.json({ error: 'Admin profile not found' }, { status: 500 })
  }

  let rawEvents: EventbriteEvent[]
  try {
    rawEvents = await fetchEvents(token, orgId)
  } catch (err) {
    console.error('[cron/sync-eventbrite] fetch failed:', err)
    return NextResponse.json({ error: 'Eventbrite fetch failed' }, { status: 502 })
  }

  if (rawEvents.length === 0) {
    console.log('[cron/sync-eventbrite] no live events returned')
    return NextResponse.json({ inserted: 0, updated: 0, total: 0, duration_ms: Date.now() - startedAt })
  }

  // Map to DB rows
  const mapped: MappedRow[] = rawEvents.map(e => {
    const title = e.name?.text?.trim()
    if (!title) return null
    const isFree = e.is_free === true
    const isPaid = !isFree
    const minMajor = e.ticket_availability?.minimum_ticket_price?.major_value
    const ticketPrice = isPaid && minMajor ? Number(minMajor) || 0 : 0
    const currency = e.currency?.toUpperCase() ?? 'EUR'
    const addr = e.venue?.address ?? null
    const lat = addr?.latitude != null ? Number(addr.latitude) : null
    const lng = addr?.longitude != null ? Number(addr.longitude) : null
    const city = addr?.city ?? null
    const country = addr?.country ?? null
    const fallback = [addr?.address_1, city, country].filter(Boolean).join(', ')
    const venueAddress = addr?.localized_address_display ?? (fallback || null)
    return {
      creator_id:      creatorId,
      title,
      description:     e.description?.text?.trim() || null,
      category:        e.category?.short_name ?? e.category?.name ?? null,
      cover_image_url: e.logo?.url ?? e.logo?.original?.url ?? null,
      tags:            [] as string[],
      status:          'published' as const,
      starts_at:       e.start?.utc ?? null,
      ends_at:         e.end?.utc ?? null,
      timezone:        e.start?.timezone ?? 'UTC',
      is_online:       e.online_event === true,
      venue_name:      e.venue?.name ?? null,
      venue_address:   venueAddress,
      meeting_url:     null as null,
      is_paid:         isPaid,
      ticket_price:    ticketPrice,
      ticket_price_eur: currency === 'EUR' ? ticketPrice : 0,
      currency_code:   currency,
      max_attendees:   null as null,
      attendee_count:  0,
      organiser_name:  null as null,
      organiser_bio:   null as null,
      country,
      region:          addr?.region ?? null,
      city,
      latitude:        Number.isFinite(lat) ? lat : null,
      longitude:       Number.isFinite(lng) ? lng : null,
      location_label:  venueAddress ?? (city && country ? `${city}, ${country}` : null),
      external_id:     e.id,
      external_source: 'eventbrite' as const,
      external_url:    e.url ?? null,
    } satisfies MappedRow
  }).filter((r): r is MappedRow => r !== null)

  // Two-phase upsert
  const externalIds = mapped.map(m => m.external_id)
  const { data: existing } = await admin
    .from('events')
    .select('id, external_id')
    .in('external_id', externalIds)

  const existingSet = new Set(
    ((existing ?? []) as Array<{ external_id: string }>).map(r => r.external_id).filter(Boolean)
  )

  const toInsert = mapped.filter(m => !existingSet.has(m.external_id))
  const toUpdate = mapped.filter(m =>  existingSet.has(m.external_id))

  let inserted = 0
  if (toInsert.length > 0) {
    const { count } = await admin.from('events').insert(toInsert, { count: 'exact' })
    inserted = count ?? toInsert.length
  }

  let updated = 0
  for (const row of toUpdate) {
    const { creator_id: _ignored, ...payload } = row
    void _ignored
    const { error } = await admin.from('events').update(payload).eq('external_id', row.external_id)
    if (!error) updated++
  }

  const duration = Date.now() - startedAt
  console.log(`[cron/sync-eventbrite] inserted=${inserted} updated=${updated} total=${rawEvents.length} ${duration}ms`)
  return NextResponse.json({ inserted, updated, total: rawEvents.length, duration_ms: duration })
}
