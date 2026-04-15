export const dynamic = 'force-dynamic'
export const maxDuration = 60  // Eventbrite API + DB writes can take a while
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ────────────────────────────────────────────────────────────────────────────
// POST /api/events/sync-eventbrite
// ────────────────────────────────────────────────────────────────────────────
//
// Pulls published events from Eventbrite and upserts them into
// public.events. Triggered manually by the "🔄 Sync Eventbrite" button
// on /events (admin-only) and available for a cron job later.
//
// Prereqs:
//   * EVENTBRITE_PRIVATE_TOKEN — Eventbrite private token from
//     https://www.eventbrite.com/platform/api-keys/ (or Account → App
//     Management)
//   * EVENTBRITE_ORG_ID — organisation id the token has access to.
//     Find yours via GET /api/events/eventbrite-org (this file's
//     sibling helper endpoint).
//   * Migration 20260414000003_events_external_id.sql applied — adds
//     external_id, external_source, external_url columns + unique
//     partial index used for dedup.
//
// Auth: admin only (profiles.role = 'admin').
//
// Dedup strategy:
//   * We DON'T use PostgREST's .upsert({ onConflict: 'external_id' })
//     because the unique index in the migration is partial (WHERE
//     external_id IS NOT NULL) and Supabase's JS client can't specify
//     the WHERE clause on ON CONFLICT — it would error on re-sync.
//   * Instead we do a two-phase approach:
//       1. Fetch existing external_ids from the DB (one SELECT with
//          .in() — cheap even for hundreds of events).
//       2. Partition the incoming events into INSERT (new external_ids)
//          and UPDATE (existing external_ids) sets.
//       3. Bulk-insert the new ones. Update the existing ones one-by-one
//          (there's rarely more than a handful to update per sync).
//   * Returns granular counts: { inserted, updated, skipped, total }.
//
// Field mapping — Eventbrite `Event` object → public.events columns:
//   name.text                                 → title
//   description.text                          → description
//   start.utc                                 → starts_at
//   end.utc                                   → ends_at
//   start.timezone                            → timezone
//   url                                       → external_url
//   online_event                              → is_online
//   venue.name                                → venue_name
//   venue.address.localized_address_display   → venue_address
//   venue.address.city                        → city
//   venue.address.country                     → country
//   venue.address.region                      → region
//   venue.address.latitude                    → latitude
//   venue.address.longitude                   → longitude
//   venue.address.city + country              → location_label (fallback)
//   is_free                                   → !is_paid
//   ticket_availability.minimum_ticket_price  → ticket_price
//   currency                                  → currency_code
//   logo.url                                  → cover_image_url
//   category.short_name                       → category
//   id                                        → external_id
//   'eventbrite'                              → external_source
//
// Expansions requested: `logo,venue,category,ticket_availability`
//   — every one of these is available on the Events list endpoint
//     (unlike `ticket_classes` which is per-event only, so we use
//     `ticket_availability.minimum_ticket_price` instead to keep
//     this sync to a single paginated call).
//
// Pagination: caps at 20 pages × 50 events = 1000 events per sync,
// which is generous for a community platform. If your Eventbrite org
// has more than that, the sync job needs chunking by date range.

interface EventbriteEvent {
  id: string
  name: { text: string | null; html?: string | null } | null
  description: { text: string | null; html?: string | null } | null
  url: string | null
  start: { timezone: string | null; local: string | null; utc: string | null } | null
  end:   { timezone: string | null; local: string | null; utc: string | null } | null
  online_event: boolean
  is_free: boolean
  currency: string | null
  status: string
  logo: {
    url: string | null
    original?: { url: string | null } | null
  } | null
  venue: {
    name: string | null
    address: {
      address_1?: string | null
      address_2?: string | null
      city?: string | null
      region?: string | null
      postal_code?: string | null
      country?: string | null
      latitude?: string | null
      longitude?: string | null
      localized_address_display?: string | null
    } | null
  } | null
  category: {
    id: string
    name: string | null
    short_name: string | null
  } | null
  ticket_availability: {
    has_available_tickets?: boolean
    minimum_ticket_price?: {
      currency: string | null
      major_value: string | null
      value: number | null
    } | null
    maximum_ticket_price?: {
      currency: string | null
      major_value: string | null
      value: number | null
    } | null
  } | null
}

interface EventbriteListResponse {
  events?: EventbriteEvent[]
  pagination?: {
    page_number?: number
    page_count?: number
    page_size?: number
    object_count?: number
    has_more_items?: boolean
    continuation?: string | null
  }
  error?: string
  error_description?: string
}

// Row shape we insert into public.events. Kept explicit so TypeScript
// catches drift between the field mapping and the table schema.
interface MappedEventRow {
  creator_id:         string | null
  title:              string
  description:        string | null
  category:           string | null
  cover_image_url:    string | null
  tags:               string[]
  status:             'published'
  starts_at:          string | null
  ends_at:            string | null
  timezone:           string
  is_online:          boolean
  venue_name:         string | null
  venue_address:      string | null
  meeting_url:        string | null
  is_paid:            boolean
  ticket_price:       number
  ticket_price_eur:   number
  currency_code:      string
  max_attendees:      number | null
  attendee_count:     number
  organiser_name:     string | null
  organiser_bio:      string | null
  country:            string | null
  region:             string | null
  city:               string | null
  latitude:           number | null
  longitude:          number | null
  location_label:     string | null
  external_id:        string
  external_source:    'eventbrite'
  external_url:       string | null
}

function mapEvent(e: EventbriteEvent, creatorId: string | null): MappedEventRow | null {
  // Eventbrite can return events with no title or no start time if the
  // organiser abandoned a draft. Skip them — we require a title for
  // UI sanity.
  const title = e.name?.text?.trim()
  if (!title) return null

  // Ticket pricing — Eventbrite's is_free is the source of truth for
  // "is this paid"; ticket_availability.minimum_ticket_price is only
  // populated on paid events.
  const isFree = e.is_free === true
  const isPaid = !isFree
  const minMajor = e.ticket_availability?.minimum_ticket_price?.major_value
  const ticketPrice = isPaid && minMajor ? Number(minMajor) || 0 : 0
  const currency = e.currency?.toUpperCase() ?? e.ticket_availability?.minimum_ticket_price?.currency?.toUpperCase() ?? 'EUR'

  // Venue — the address object is optional; we pull everything we
  // can and fall back to the venue name if the address is missing.
  const addr = e.venue?.address ?? null
  const latStr = addr?.latitude
  const lngStr = addr?.longitude
  const latitude  = latStr != null && latStr !== '' ? Number(latStr) : null
  const longitude = lngStr != null && lngStr !== '' ? Number(lngStr) : null
  const city     = addr?.city ?? null
  const region   = addr?.region ?? null
  const country  = addr?.country ?? null
  const venueName = e.venue?.name ?? null
  // Prefer Eventbrite's localized_address_display when present, else
  // fall back to concatenating parts. Parenthesised so TS5076 (mixing
  // `??` and `||` without parens) doesn't fire.
  const fallbackAddress = [addr?.address_1, addr?.city, addr?.country].filter(Boolean).join(', ')
  const venueAddress = addr?.localized_address_display ?? (fallbackAddress !== '' ? fallbackAddress : null)
  const locationLabel = venueAddress ?? (city && country ? `${city}, ${country}` : null)

  return {
    creator_id:       creatorId,
    title,
    description:      e.description?.text?.trim() || null,
    category:         e.category?.short_name ?? e.category?.name ?? null,
    cover_image_url:  e.logo?.url ?? e.logo?.original?.url ?? null,
    tags:             [],
    status:           'published',
    starts_at:        e.start?.utc ?? null,
    ends_at:          e.end?.utc ?? null,
    timezone:         e.start?.timezone ?? 'UTC',
    is_online:        e.online_event === true,
    venue_name:       venueName,
    venue_address:    venueAddress,
    meeting_url:      null, // Eventbrite doesn't expose the online meeting URL in the list endpoint
    is_paid:          isPaid,
    ticket_price:     ticketPrice,
    ticket_price_eur: currency === 'EUR' ? ticketPrice : 0, // no FX here — set to 0 for non-EUR, best-effort
    currency_code:    currency,
    max_attendees:    null,
    attendee_count:   0,
    organiser_name:   null,
    organiser_bio:    null,
    country,
    region,
    city,
    latitude:         Number.isFinite(latitude) ? latitude : null,
    longitude:        Number.isFinite(longitude) ? longitude : null,
    location_label:   locationLabel,
    external_id:      e.id,
    external_source:  'eventbrite',
    external_url:     e.url ?? null,
  }
}

async function fetchAllEventbriteEvents(token: string, orgId: string): Promise<EventbriteEvent[]> {
  const all: EventbriteEvent[] = []
  const PER_PAGE = 50
  const MAX_PAGES = 20
  let continuation: string | null = null

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      // status=live returns only published, currently-active events
      // (draft/completed/canceled are excluded server-side)
      status: 'live',
      // We want venue + logo + category + ticket_availability inline
      // so we can map without N+1 per-event requests
      expand: 'logo,venue,category,ticket_availability',
      // Server-side sort by start date — future-first matches our
      // feed ordering
      order_by: 'start_asc',
      page_size: String(PER_PAGE),
    })
    if (continuation) params.set('continuation', continuation)

    const url = `https://www.eventbriteapi.com/v3/organizations/${orgId}/events/?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Eventbrite API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`)
    }

    const data = (await res.json()) as EventbriteListResponse
    const events = data.events ?? []
    all.push(...events)

    if (!data.pagination?.has_more_items) break
    continuation = data.pagination?.continuation ?? null
    if (!continuation) break
  }

  return all
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    // ── 1. Auth: admin-session OR CRON_SECRET bearer token ──────────────
    // The route has two callers:
    //   * Admin UI button (authenticated via Supabase session, checked
    //     against profiles.role = 'admin')
    //   * Vercel cron / external scheduler (authenticated via a
    //     shared bearer token — Authorization: Bearer <CRON_SECRET>)
    //
    // When CRON_SECRET is set, a request presenting the matching
    // Authorization header bypasses the session lookup entirely and
    // falls back to a placeholder user_id (NULL creator_id) for the
    // events it upserts. Without this branch the cron endpoint would
    // have no way to authenticate because it never carries a session
    // cookie.
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization') ?? ''
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`

    let userIdForCreator: string | null = null

    if (!isCron) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (!profile || profile.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
      }
      userIdForCreator = user.id
    }

    // ── 2. Env check ────────────────────────────────────────────────────
    const token = process.env.EVENTBRITE_PRIVATE_TOKEN
    const orgId = process.env.EVENTBRITE_ORG_ID
    if (!token) {
      return NextResponse.json(
        {
          error: 'EVENTBRITE_PRIVATE_TOKEN is not set in the environment.',
          hint: 'Add it to Vercel → Project Settings → Environment Variables and redeploy.',
        },
        { status: 500 },
      )
    }
    if (!orgId) {
      return NextResponse.json(
        {
          error: 'EVENTBRITE_ORG_ID is not set in the environment.',
          hint: 'Find your org id via GET /api/events/eventbrite-org, then add it to Vercel env vars and redeploy.',
        },
        { status: 500 },
      )
    }

    // ── 3. Fetch from Eventbrite ────────────────────────────────────────
    let rawEvents: EventbriteEvent[]
    try {
      rawEvents = await fetchAllEventbriteEvents(token, orgId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[sync-eventbrite] fetch failed:', message)
      return NextResponse.json(
        { error: `Eventbrite fetch failed: ${message}` },
        { status: 502 },
      )
    }
    console.log(`[sync-eventbrite] fetched ${rawEvents.length} events from Eventbrite org ${orgId}`)

    // ── 4. Map to our row shape ─────────────────────────────────────────
    const mapped: MappedEventRow[] = []
    let skippedNoTitle = 0
    for (const raw of rawEvents) {
      const row = mapEvent(raw, userIdForCreator)
      if (row) mapped.push(row)
      else skippedNoTitle += 1
    }

    if (mapped.length === 0) {
      return NextResponse.json({
        ok: true,
        total: rawEvents.length,
        inserted: 0,
        updated: 0,
        skipped: skippedNoTitle,
        duration_ms: Date.now() - startedAt,
        message: rawEvents.length === 0
          ? 'No events returned by Eventbrite. Check your org has live events with status=live.'
          : 'All events were skipped (missing title).',
      })
    }

    // ── 5. Two-phase upsert ─────────────────────────────────────────────
    // We use the admin client for writes so RLS (the creator check on
    // UPDATE) doesn't block re-syncs when a different admin triggers
    // the sync than the one who originally imported the events.
    const admin = createAdminClient()
    const externalIds = mapped.map(m => m.external_id)

    // Fetch existing rows by external_id — one SELECT with .in()
    const { data: existing, error: existingErr } = await admin
      .from('events')
      .select('id, external_id')
      .in('external_id', externalIds)
    if (existingErr) {
      console.error('[sync-eventbrite] fetch existing failed:', existingErr.message)
      return NextResponse.json(
        { error: `Could not read existing events: ${existingErr.message}` },
        { status: 500 },
      )
    }
    const existingSet = new Set(
      ((existing ?? []) as Array<{ external_id: string }>)
        .map(row => row.external_id)
        .filter(Boolean),
    )

    // Partition
    const toInsert = mapped.filter(m => !existingSet.has(m.external_id))
    const toUpdate = mapped.filter(m =>  existingSet.has(m.external_id))

    // Insert new rows in one bulk call
    let inserted = 0
    if (toInsert.length > 0) {
      const { error: insertErr, count } = await admin
        .from('events')
        .insert(toInsert, { count: 'exact' })
      if (insertErr) {
        console.error('[sync-eventbrite] bulk insert failed:', insertErr.message)
        return NextResponse.json(
          { error: `Insert failed: ${insertErr.message}` },
          { status: 500 },
        )
      }
      inserted = count ?? toInsert.length
    }

    // Update existing rows one-by-one. Typically only a handful per
    // re-sync (organiser edited the description, moved the date, etc).
    // If this ever becomes a hot path we can batch via an RPC.
    let updated = 0
    let updateErrors = 0
    for (const row of toUpdate) {
      // Don't overwrite creator_id on re-sync — the row was originally
      // created under whichever admin triggered the first sync, and
      // changing owners every sync would thrash the creator FK and
      // break "my events" views for that user.
      const { creator_id: _creatorIdIgnored, ...updatePayload } = row
      void _creatorIdIgnored
      const { error: updateErr } = await admin
        .from('events')
        .update(updatePayload)
        .eq('external_id', row.external_id)
      if (updateErr) {
        console.error('[sync-eventbrite] update failed for', row.external_id, updateErr.message)
        updateErrors += 1
      } else {
        updated += 1
      }
    }

    const duration = Date.now() - startedAt
    console.log(
      `[sync-eventbrite] done: ${inserted} inserted, ${updated} updated, ` +
      `${skippedNoTitle} skipped, ${updateErrors} update errors, ${duration}ms`,
    )

    return NextResponse.json({
      ok: true,
      total: rawEvents.length,
      inserted,
      updated,
      skipped: skippedNoTitle,
      update_errors: updateErrors,
      duration_ms: duration,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sync-eventbrite] unexpected error:', message, err)
    return NextResponse.json(
      { error: `Unexpected error: ${message}` },
      { status: 500 },
    )
  }
}
