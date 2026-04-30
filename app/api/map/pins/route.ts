export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { REAL_EVENT_SOURCE_FILTER, REAL_JOB_SOURCE_FILTER } from '@/lib/dataIntegrity'
import { resolveCoords, type ResolvedCoords } from '@/lib/geo/city-lookup'

type ProfileLocation = {
  latitude?: number | null
  longitude?: number | null
  city?: string | null
  country?: string | null
  location?: string | null
  location_label?: string | null
  username?: string | null
  show_on_map?: boolean | null
  deleted_at?: string | null
}

function withCoords<T extends Record<string, unknown>>(row: T, coords: ResolvedCoords) {
  return {
    ...row,
    latitude: coords.lat,
    longitude: coords.lng,
    location_confidence: coords.confidence,
    location_matched: coords.matched,
  }
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  }
}

export async function GET() {
  try {
    const admin = createAdminClient()

    const [membersResult, eventsResult, listingsResult, jobsResult] = await Promise.allSettled([
      admin
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, location, location_label, city, country, latitude, longitude, account_type, show_on_map')
        .is('deleted_at', null)
        .or('show_on_map.is.null,show_on_map.eq.true')
        .limit(1000),

      admin
        .from('events')
        .select('id, title, starts_at, venue_name, latitude, longitude, city, country, ticket_price, is_paid, is_online, is_platform_curated, external_source, organizer_id')
        .eq('status', 'published')
        .or(REAL_EVENT_SOURCE_FILTER)
        .gte('starts_at', new Date().toISOString())
        .limit(1000),

      admin
        .from('listings')
        .select('id, title, price_eur, currency_code, cover_image, category, seller_id, product_type, service_mode, location, location_label, latitude, longitude, city, country, profiles!listings_seller_id_fkey(id, latitude, longitude, city, country, location, location_label, username, show_on_map, deleted_at)')
        .eq('status', 'active')
        .limit(1000),

      admin
        .from('jobs')
        .select('id, title, company_name, location, latitude, longitude, city, country, is_remote, salary_min_eur, salary_max_eur, job_type, category, created_at, job_source, status')
        .in('status', ['active', 'open'])
        .or(REAL_JOB_SOURCE_FILTER)
        .limit(1000),
    ])

    const pins: unknown[] = []
    const diagnostics = {
      members: { count: 0, skipped: 0 },
      events: { count: 0, skipped: 0 },
      products: { count: 0, skipped: 0 },
      services: { count: 0, skipped: 0 },
      jobs: { count: 0, skipped: 0 },
    }

    if (membersResult.status === 'fulfilled' && !membersResult.value.error) {
      for (const member of membersResult.value.data ?? []) {
        const coords = resolveCoords(member)
        if (!coords) {
          diagnostics.members.skipped += 1
          continue
        }
        pins.push(withCoords({ ...member, type: 'member' }, coords))
        diagnostics.members.count += 1
      }
    } else {
      const err = membersResult.status === 'fulfilled' ? membersResult.value.error?.message : membersResult.reason
      console.error('[map/pins] members error:', err)
    }

    if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
      for (const event of eventsResult.value.data ?? []) {
        if (event.is_online && !event.is_platform_curated) {
          diagnostics.events.skipped += 1
          continue
        }
        const coords = resolveCoords(event)
        if (!coords) {
          diagnostics.events.skipped += 1
          continue
        }
        pins.push(withCoords({ ...event, type: 'event' }, coords))
        diagnostics.events.count += 1
      }
    } else {
      const err = eventsResult.status === 'fulfilled' ? eventsResult.value.error?.message : eventsResult.reason
      console.error('[map/pins] events error:', err)
    }

    if (listingsResult.status === 'fulfilled' && !listingsResult.value.error) {
      for (const listing of listingsResult.value.data ?? []) {
        const profile = (listing.profiles ?? null) as ProfileLocation | null
        const coords = resolveCoords(listing) ?? (profile?.show_on_map === false || profile?.deleted_at ? null : resolveCoords(profile ?? {}))
        const productType = String(listing.product_type ?? '').toLowerCase()
        const serviceMode = listing.service_mode == null ? null : String(listing.service_mode)
        const pinType = productType === 'physical'
          ? 'product'
          : (productType === 'service' || (!productType && serviceMode) ? 'service' : 'product')

        if (!coords) {
          if (pinType === 'service') diagnostics.services.skipped += 1
          else diagnostics.products.skipped += 1
          continue
        }

        pins.push(withCoords({
          id: listing.id,
          title: listing.title,
          price_eur: listing.price_eur,
          currency_code: listing.currency_code,
          cover_image: listing.cover_image,
          category: listing.category,
          product_type: listing.product_type,
          service_mode: listing.service_mode,
          seller_id: listing.seller_id,
          seller_username: profile?.username ?? null,
          city: listing.city ?? profile?.city ?? null,
          country: listing.country ?? profile?.country ?? null,
          location: listing.location ?? profile?.location ?? null,
          type: pinType,
        }, coords))

        if (pinType === 'service') diagnostics.services.count += 1
        else diagnostics.products.count += 1
      }
    } else {
      const err = listingsResult.status === 'fulfilled' ? listingsResult.value.error?.message : listingsResult.reason
      console.error('[map/pins] listings error:', err)
    }

    if (jobsResult.status === 'fulfilled' && !jobsResult.value.error) {
      for (const job of jobsResult.value.data ?? []) {
        if (job.is_remote === true) {
          diagnostics.jobs.skipped += 1
          continue
        }
        const coords = resolveCoords(job)
        if (!coords) {
          diagnostics.jobs.skipped += 1
          continue
        }
        pins.push(withCoords({ ...job, type: 'job' }, coords))
        diagnostics.jobs.count += 1
      }
    } else {
      const err = jobsResult.status === 'fulfilled' ? jobsResult.value.error?.message : jobsResult.reason
      console.warn('[map/pins] jobs warning:', err)
    }

    console.log('[map/pins] counts:', { total: pins.length, ...diagnostics })
    return NextResponse.json({ pins, _diagnostic: diagnostics }, { headers: noStoreHeaders() })
  } catch (err) {
    console.error('[GET /api/map/pins]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: noStoreHeaders() })
  }
}
