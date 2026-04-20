export const dynamic = 'force-dynamic'
// ============================================================================
// GET /api/map/pins
// Returns all map-pinnable entities: members, events, products, jobs.
// Each item has a `type` field: 'member' | 'event' | 'product' | 'job'
//
// Notes on data availability:
//   - Listings have no lat/lng yet → we join via seller profile location
//   - Profiles may have null username → shown as "Member"
//   - Only events reliably have lat/lng from the geo-init API
// ============================================================================
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const [membersResult, eventsResult, productsResult, jobsResult] =
      await Promise.allSettled([
        // Members with location — no username filter (many profiles have null username)
        supabase
          .from('profiles')
          .select('id, username, avatar_url, bio, city, country, latitude, longitude, account_type')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
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

        // Active listings — join seller profile for location since listings lack lat/lng
        // Use the embedded select to get seller profile location
        supabase
          .from('listings')
          .select('id, title, price_eur, currency_code, cover_image_url, category, seller_id, latitude, longitude, city, country, profiles!listings_seller_id_fkey(latitude, longitude, city, country)')
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
      console.log(`[map/pins] members: ${membersResult.value.data?.length ?? 0}`)
    } else {
      const err = membersResult.status === 'fulfilled' ? membersResult.value.error?.message : membersResult.reason
      console.error('[map/pins] members error:', err)
    }

    // Events
    if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
      for (const e of eventsResult.value.data ?? []) {
        pins.push({ ...e, type: 'event' })
      }
      console.log(`[map/pins] events: ${eventsResult.value.data?.length ?? 0}`)
    } else {
      const err = eventsResult.status === 'fulfilled' ? eventsResult.value.error?.message : eventsResult.reason
      console.error('[map/pins] events error:', err)
    }

    // Products — use listing lat/lng if set, otherwise fall back to seller profile location
    if (productsResult.status === 'fulfilled' && !productsResult.value.error) {
      let productCount = 0
      for (const p of productsResult.value.data ?? []) {
        // Try listing's own lat/lng first, fall back to seller profile location
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profile = (p as any).profiles
        const lat = p.latitude ?? profile?.latitude
        const lng = p.longitude ?? profile?.longitude
        const city = p.city ?? profile?.city
        const country = p.country ?? profile?.country

        if (lat == null || lng == null) continue // skip if no location at all

        pins.push({
          id: p.id,
          title: p.title,
          price_eur: p.price_eur,
          currency_code: p.currency_code,
          cover_image_url: p.cover_image_url,
          category: p.category,
          latitude: lat,
          longitude: lng,
          city,
          country,
          type: 'product',
        })
        productCount++
      }
      console.log(`[map/pins] products: ${productCount} (of ${productsResult.value.data?.length ?? 0} listings)`)
    } else {
      const err = productsResult.status === 'fulfilled' ? productsResult.value.error?.message : productsResult.reason
      console.error('[map/pins] products error:', err)
    }

    // Jobs
    if (jobsResult.status === 'fulfilled' && !jobsResult.value.error) {
      for (const j of jobsResult.value.data ?? []) {
        pins.push({ ...j, type: 'job' })
      }
      console.log(`[map/pins] jobs: ${jobsResult.value.data?.length ?? 0}`)
    } else {
      const err = jobsResult.status === 'fulfilled' ? jobsResult.value.error?.message : jobsResult.reason
      console.warn('[map/pins] jobs warning:', err)
    }

    console.log(`[map/pins] total pins: ${pins.length}`)
    return NextResponse.json({ pins })
  } catch (err) {
    console.error('[GET /api/map/pins]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
