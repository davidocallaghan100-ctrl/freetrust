export const dynamic = 'force-dynamic'
// ============================================================================
// GET /api/map/pins
// Returns all map-pinnable entities: members, events, products, jobs.
// Each item has a `type` field: 'member' | 'event' | 'product' | 'job'
// Uses Promise.allSettled so one failing query never crashes the whole response.
// ============================================================================
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const [membersResult, eventsResult, productsResult, jobsResult] =
      await Promise.allSettled([
        // Members with location (no onboarding_complete filter — include all located users)
        supabase
          .from('profiles')
          .select('id, username, avatar_url, bio, city, country, latitude, longitude, account_type')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .not('username', 'is', null)
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

        // Active product listings
        supabase
          .from('listings')
          .select('id, title, price_eur, currency_code, cover_image_url, latitude, longitude, city, country, category')
          .not('latitude', 'is', null)
          .eq('status', 'active')
          .limit(500),

        // Active non-remote jobs
        supabase
          .from('jobs')
          .select('id, title, salary_min_eur, salary_max_eur, latitude, longitude, city, country')
          .not('latitude', 'is', null)
          .eq('status', 'active')
          .limit(500),
      ])

    const pins: unknown[] = []

    if (membersResult.status === 'fulfilled' && !membersResult.value.error) {
      for (const m of membersResult.value.data ?? []) {
        pins.push({ ...m, type: 'member' })
      }
    } else if (membersResult.status === 'rejected') {
      console.error('[map/pins] members query failed:', membersResult.reason)
    } else if (membersResult.status === 'fulfilled' && membersResult.value.error) {
      console.error('[map/pins] members error:', membersResult.value.error.message)
    }

    if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
      for (const e of eventsResult.value.data ?? []) {
        pins.push({ ...e, type: 'event' })
      }
    } else if (eventsResult.status === 'rejected') {
      console.error('[map/pins] events query failed:', eventsResult.reason)
    } else if (eventsResult.status === 'fulfilled' && eventsResult.value.error) {
      console.error('[map/pins] events error:', eventsResult.value.error.message)
    }

    if (productsResult.status === 'fulfilled' && !productsResult.value.error) {
      for (const p of productsResult.value.data ?? []) {
        pins.push({ ...p, type: 'product' })
      }
    } else if (productsResult.status === 'rejected') {
      console.error('[map/pins] products query failed:', productsResult.reason)
    } else if (productsResult.status === 'fulfilled' && productsResult.value.error) {
      console.error('[map/pins] products error:', productsResult.value.error.message)
    }

    if (jobsResult.status === 'fulfilled' && !jobsResult.value.error) {
      for (const j of jobsResult.value.data ?? []) {
        pins.push({ ...j, type: 'job' })
      }
    } else if (jobsResult.status === 'rejected') {
      console.error('[map/pins] jobs query failed:', jobsResult.reason)
    } else if (jobsResult.status === 'fulfilled' && jobsResult.value.error) {
      // Jobs table may not exist or column may be missing — log and skip
      console.warn('[map/pins] jobs warning:', jobsResult.value.error.message)
    }

    return NextResponse.json({ pins })
  } catch (err) {
    console.error('[GET /api/map/pins]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
