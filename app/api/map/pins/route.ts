export const dynamic = 'force-dynamic'
// ============================================================================
// GET /api/map/pins
// Returns all map-pinnable entities: members, events, products, services, jobs.
// Each item has a `type` field: 'member' | 'event' | 'product' | 'service' | 'job'
//
// Location strategy:
//   1. Use exact lat/lng if stored on the row
//   2. Fall back to seller/poster profile lat/lng for listings/jobs
//   3. Fall back to approximate city-centre coords from CITY_COORDS lookup
//   4. Skip if no location data at all
// ============================================================================

// Approximate city-centre coordinates for common cities in member profiles
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Ireland
  'dublin': { lat: 53.3498, lng: -6.2603 },
  'cork': { lat: 51.8985, lng: -8.4756 },
  'galway': { lat: 53.2707, lng: -9.0568 },
  'limerick': { lat: 52.6638, lng: -8.6267 },
  'waterford': { lat: 52.2593, lng: -7.1101 },
  'kilkenny': { lat: 52.6541, lng: -7.2448 },
  'wexford': { lat: 52.3342, lng: -6.4575 },
  'sligo': { lat: 54.2766, lng: -8.4761 },
  'drogheda': { lat: 53.7183, lng: -6.3484 },
  'dundalk': { lat: 54.0042, lng: -6.4064 },
  'athlone': { lat: 53.4239, lng: -7.9407 },
  'tralee': { lat: 52.2675, lng: -9.7016 },
  'ennis': { lat: 52.8458, lng: -8.9817 },
  'killarney': { lat: 52.0592, lng: -9.5056 },
  'bray': { lat: 53.2018, lng: -6.1110 },
  'naas': { lat: 53.2197, lng: -6.6665 },
  'navan': { lat: 53.6534, lng: -6.6798 },
  'portlaoise': { lat: 53.0347, lng: -7.2993 },
  'tullamore': { lat: 53.2742, lng: -7.4880 },
  'mullingar': { lat: 53.5265, lng: -7.3381 },
  // UK
  'london': { lat: 51.5074, lng: -0.1278 },
  'manchester': { lat: 53.4808, lng: -2.2426 },
  'birmingham': { lat: 52.4862, lng: -1.8904 },
  'glasgow': { lat: 55.8642, lng: -4.2518 },
  'edinburgh': { lat: 55.9533, lng: -3.1883 },
  'bristol': { lat: 51.4545, lng: -2.5879 },
  'leeds': { lat: 53.8008, lng: -1.5491 },
  'liverpool': { lat: 53.4084, lng: -2.9916 },
  'belfast': { lat: 54.5973, lng: -5.9301 },
  // Europe
  'paris': { lat: 48.8566, lng: 2.3522 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'milan': { lat: 45.4654, lng: 9.1859 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'brussels': { lat: 50.8503, lng: 4.3517 },
  'vienna': { lat: 48.2082, lng: 16.3738 },
  'stockholm': { lat: 59.3293, lng: 18.0686 },
  'oslo': { lat: 59.9139, lng: 10.7522 },
  'copenhagen': { lat: 55.6761, lng: 12.5683 },
  'helsinki': { lat: 60.1699, lng: 24.9384 },
  'zurich': { lat: 47.3769, lng: 8.5417 },
  'geneva': { lat: 46.2044, lng: 6.1432 },
  'munich': { lat: 48.1351, lng: 11.5820 },
  'frankfurt': { lat: 50.1109, lng: 8.6821 },
  'warsaw': { lat: 52.2297, lng: 21.0122 },
  'prague': { lat: 50.0755, lng: 14.4378 },
  'budapest': { lat: 47.4979, lng: 19.0402 },
  'bucharest': { lat: 44.4268, lng: 26.1025 },
  // North America
  'new york': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'toronto': { lat: 43.6532, lng: -79.3832 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'boston': { lat: 42.3601, lng: -71.0589 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'austin': { lat: 30.2672, lng: -97.7431 },
  'vancouver': { lat: 49.2827, lng: -123.1207 },
  'montreal': { lat: 45.5017, lng: -73.5673 },
  // Asia-Pacific & other
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'melbourne': { lat: -37.8136, lng: 144.9631 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
  // USA smaller cities
  'mt. dora': { lat: 28.7739, lng: -81.6463 },
  'mt dora': { lat: 28.7739, lng: -81.6463 },
  'middelharnis': { lat: 51.7612, lng: 4.1680 },
}

function cityCoords(city?: string | null, country?: string | null): { lat: number; lng: number } | null {
  if (!city) return null
  const key = city.toLowerCase().trim()
  if (CITY_COORDS[key]) return CITY_COORDS[key]
  // Try partial match
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

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
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    // Use admin client so RLS never blocks map data
    const admin = createAdminClient()

    const [membersResult, eventsResult, listingsResult, jobsResult] =
      await Promise.allSettled([
        // All members — we'll use city fallback coords for those without exact lat/lng
        admin
          .from('profiles')
          .select('id, username, full_name, avatar_url, bio, city, country, latitude, longitude, account_type, show_on_map')
          .eq('show_on_map', true)
          .limit(500),

        // Upcoming published events (in-person OR curated — curated always show)
        admin
          .from('events')
          .select('id, title, starts_at, venue_name, latitude, longitude, city, country, ticket_price, is_paid, is_online, is_platform_curated')
          .eq('status', 'published')
          .gte('starts_at', new Date().toISOString())
          .limit(500),

        // All active listings — join seller profile for location fallback
        admin
          .from('listings')
          .select('id, title, price_eur, currency_code, cover_image, category, seller_id, latitude, longitude, city, country, profiles!listings_seller_id_fkey(id, latitude, longitude, city, country, username)')
          .eq('status', 'active')
          .limit(500),

        // Active jobs — include those without lat/lng so we can use city fallback
        admin
          .from('jobs')
          .select('id, title, salary_min_eur, salary_max_eur, latitude, longitude, city, country, location_city, location_country, location_type, profiles!jobs_poster_id_fkey(latitude, longitude, city, country)')
          .eq('status', 'active')
          .limit(500),
      ])

    const pins: unknown[] = []

    // ── Members ───────────────────────────────────────────────────────────────
    if (membersResult.status === 'fulfilled' && !membersResult.value.error) {
      let count = 0
      for (const m of membersResult.value.data ?? []) {
        let lat = m.latitude
        let lng = m.longitude
        // Fall back to city-centre coords if no exact location
        if (lat == null || lng == null) {
          const fallback = cityCoords(m.city, m.country)
          if (fallback) {
            // Add slight random jitter so multiple members in same city don't stack exactly
            lat = fallback.lat + (Math.random() - 0.5) * 0.04
            lng = fallback.lng + (Math.random() - 0.5) * 0.04
          }
        }
        if (lat == null || lng == null) continue
        pins.push({ ...m, latitude: lat, longitude: lng, type: 'member' })
        count++
      }
      console.log('[map/pins] members: ' + count)
    } else {
      const err = membersResult.status === 'fulfilled' ? membersResult.value.error?.message : membersResult.reason
      console.error('[map/pins] members error:', err)
    }

    // ── Events ────────────────────────────────────────────────────────────────
    if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
      let count = 0
      for (const e of eventsResult.value.data ?? []) {
        let lat = e.latitude
        let lng = e.longitude
        // Fall back to city-centre coords
        if (lat == null || lng == null) {
          const fallback = cityCoords(e.city, e.country)
          if (fallback) { lat = fallback.lat; lng = fallback.lng }
        }
        if (lat == null || lng == null) continue
        // Skip online-only events unless platform-curated (which have real venues)
        if (e.is_online && !e.is_platform_curated) continue
        pins.push({ ...e, latitude: lat, longitude: lng, type: 'event' })
        count++
      }
      console.log('[map/pins] events: ' + count)
    } else {
      const err = eventsResult.status === 'fulfilled' ? eventsResult.value.error?.message : eventsResult.reason
      console.error('[map/pins] events error:', err)
    }

    // ── Listings (Products + Services) ────────────────────────────────────────
    if (listingsResult.status === 'fulfilled' && !listingsResult.value.error) {
      let productCount = 0
      let serviceCount = 0
      for (const p of listingsResult.value.data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profile = (p as any).profiles
        let lat = p.latitude ?? profile?.latitude
        let lng = p.longitude ?? profile?.longitude
        const city = p.city ?? profile?.city
        const country = p.country ?? profile?.country

        // Fall back to city-centre coords
        if (lat == null || lng == null) {
          const fallback = cityCoords(city, country)
          if (fallback) {
            lat = fallback.lat + (Math.random() - 0.5) * 0.02
            lng = fallback.lng + (Math.random() - 0.5) * 0.02
          }
        }
        if (lat == null || lng == null) continue

        const isService = p.category != null && SERVICE_CATEGORIES.has(p.category)
        const pinType = isService ? 'service' : 'product'

        pins.push({
          id: p.id,
          title: p.title,
          price_eur: p.price_eur,
          currency_code: p.currency_code,
          cover_image: (p as any).cover_image,
          category: p.category,
          seller_id: p.seller_id,
          seller_username: (profile as any)?.username ?? null,
          latitude: lat,
          longitude: lng,
          city,
          country,
          type: pinType,
        })
        if (isService) serviceCount++; else productCount++
      }
      console.log(`[map/pins] products: ${productCount}, services: ${serviceCount}`)
    } else {
      const err = listingsResult.status === 'fulfilled' ? listingsResult.value.error?.message : listingsResult.reason
      console.error('[map/pins] listings error:', err)
    }

    // ── Jobs ──────────────────────────────────────────────────────────────────
    if (jobsResult.status === 'fulfilled' && !jobsResult.value.error) {
      let count = 0
      for (const j of jobsResult.value.data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profile = (j as any).profiles
        let lat = j.latitude ?? profile?.latitude
        let lng = j.longitude ?? profile?.longitude
        const city = (j as any).location_city ?? j.city ?? profile?.city
        const country = (j as any).location_country ?? j.country ?? profile?.country

        // Fall back to city-centre coords
        if (lat == null || lng == null) {
          const fallback = cityCoords(city, country)
          if (fallback) {
            lat = fallback.lat + (Math.random() - 0.5) * 0.02
            lng = fallback.lng + (Math.random() - 0.5) * 0.02
          }
        }
        if (lat == null || lng == null) continue

        pins.push({ ...j, latitude: lat, longitude: lng, city, country, type: 'job' })
        count++
      }
      console.log('[map/pins] jobs: ' + count)
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
