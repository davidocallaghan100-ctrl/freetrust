export const dynamic = 'force-dynamic'
// ============================================================================
// GET /api/map/pins
// Returns all map-pinnable entities: members, events, products, services, jobs.
// Each item has a `type` field: 'member' | 'event' | 'product' | 'service' | 'job'
//
// Notes on data availability:
//   - Listings have no lat/lng yet → we join via seller profile location
//   - Profiles may have null username → shown as "Member"
//   - Only events reliably have lat/lng from the geo-init API
//   - show_on_map column on profiles controls map visibility (default true)
//   - Listings split: SERVICE_CATEGORIES → type:'service', everything else → type:'product'
// ============================================================================

// Categories treated as services (freelance/coaching/consulting type offerings)
const SERVICE_CATEGORIES = new Set([
  'Coaching & Mentoring',
  'coaching',
  'mentoring',
  'service',
  'services',
  'freelance',
  'consulting',
  'consulting & advisory',
  'design',
  'writing',
  'marketing',
  'development',
  'photography',
  'videography',
  'tutoring',
  'legal',
  'accounting',
  'health & wellness',
])
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const [membersResult, eventsResult, listingsResult, jobsResult] =
      await Promise.allSettled([
        // Members with location — only those who opted in to map visibility
        supabase
          .from('profiles')
          .select('id, username, avatar_url, bio, city, country, latitude, longitude, account_type')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .eq('show_on_map', true)
          .limit(500),

        // Upcoming published in-person events
        supabase
          .from('events')
          .select('id, title, starts_at, venue_name, latitude, longitude, city, country, ticket_price, is_paid, is_online')
          .not('latitude', 'is', null)
          .eq('status', 'published')
          .eq('is_online', false)
          .gte('starts_at', new Date().toISOString())
          .limit(500),

        // All active listings — join seller profile for location fallback
        // Will be split into 'product' vs 'service' based on category below
        supabase
          .from('listings')
          .select('id, title, price_eur, currency_code, cover_image, category, seller_id, latitude, longitude, city, country, profiles!listings_seller_id_fkey(latitude, longitude, city, country)')
          .eq('status', 'active')
          .limit(500),

        // Active jobs
        supabase
          .from('jobs')
          .select('id, title, salary_min_eur, salary_max_eur, latitude, longitude, city, country')
          .not('latitude', 'is', null)
          .eq('status', 'active')
          .limit(500),
      ])

    const pins: unknown[] = []

    // Members
    if (membersResult.status === 'fulfilled' && !membersResult.value.error) {
      for (const m of membersResult.value.data ?? []) {
        pins.push({ ...m, type: 'member' })
      }
      console.log('[map/pins] members: ' + (membersResult.value.data?.length ?? 0))
    } else {
      const err = membersResult.status === 'fulfilled' ? membersResult.value.error?.message : membersResult.reason
      console.error('[map/pins] members error:', err)
    }

    // Events
    if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
      for (const e of eventsResult.value.data ?? []) {
        pins.push({ ...e, type: 'event' })
      }
      console.log('[map/pins] events: ' + (eventsResult.value.data?.length ?? 0))
    } else {
      const err = eventsResult.status === 'fulfilled' ? eventsResult.value.error?.message : eventsResult.reason
      console.error('[map/pins] events error:', err)
    }

    // Listings — split into Products and Services based on category
    // Use listing lat/lng if set, otherwise fall back to seller profile location
    if (listingsResult.status === 'fulfilled' && !listingsResult.value.error) {
      let productCount = 0
      let serviceCount = 0
      for (const p of listingsResult.value.data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profile = (p as any).profiles
        const lat = p.latitude ?? profile?.latitude
        const lng = p.longitude ?? profile?.longitude
        const city = p.city ?? profile?.city
        const country = p.country ?? profile?.country

        if (lat == null || lng == null) continue // skip if no location at all

        // Determine if this listing is a service or a product
        const isService = p.category != null && SERVICE_CATEGORIES.has(p.category)
        const pinType = isService ? 'service' : 'product'

        pins.push({
          id: p.id,
          title: p.title,
          price_eur: p.price_eur,
          currency_code: p.currency_code,
          cover_image: (p as any).cover_image,
          category: p.category,
          latitude: lat,
          longitude: lng,
          city,
          country,
          type: pinType,
        })
        if (isService) serviceCount++; else productCount++
      }
      console.log(`[map/pins] products: ${productCount}, services: ${serviceCount} (of ${listingsResult.value.data?.length ?? 0} listings)`)
    } else {
      const err = listingsResult.status === 'fulfilled' ? listingsResult.value.error?.message : listingsResult.reason
      console.error('[map/pins] listings error:', err)
    }

    // Jobs
    if (jobsResult.status === 'fulfilled' && !jobsResult.value.error) {
      for (const j of jobsResult.value.data ?? []) {
        pins.push({ ...j, type: 'job' })
      }
      console.log('[map/pins] jobs: ' + (jobsResult.value.data?.length ?? 0))
    } else {
      const err = jobsResult.status === 'fulfilled' ? jobsResult.value.error?.message : jobsResult.reason
      console.warn('[map/pins] jobs warning:', err)
    }

    console.log('[map/pins] total pins: ' + pins.length)
    return NextResponse.json({ pins })
  } catch (err) {
    console.error('[GET /api/map/pins]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
