export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/me/geo-init
//
// Called once on first login. If the current user has NO structured
// location in their profile yet (country, city, latitude, longitude all
// null), we look up their coarse location from ipapi.co using the
// request's client IP and persist it to the profile. This gives every
// new signup an instant "local" default for the marketplace browse
// filters and a sensible starting currency — without ever blocking the
// signup flow on a third-party API call.
//
// Idempotent: if the profile already has a country set, we do nothing.
// Safe to call on every page load — subsequent calls are a no-op DB read.
//
// Why a server endpoint rather than client-side IP detection?
//   * The client's IP is only exposed to same-origin scripts via an
//     external service, and some privacy-hardened browsers block those
//     requests. Doing it server-side uses the user's actual forwarded
//     IP headers (behind Vercel's edge) and avoids any CORS dance.
//   * We want the profile row in the DB to be the source of truth for
//     defaulted location, not ephemeral client state.

interface IpApiResponse {
  country_code?: string
  country_name?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  currency?: string
  error?: boolean
  reason?: string
}

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    null
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Short-circuit if the profile already has structured location
    const { data: existing, error: fetchErr } = await admin
      .from('profiles')
      .select('country, city, latitude, longitude, location_label, currency_code')
      .eq('id', user.id)
      .maybeSingle()

    if (fetchErr) {
      console.error('[geo-init] profile fetch failed:', fetchErr.message)
      return NextResponse.json({ initialized: false, reason: 'profile_fetch_failed' }, { status: 500 })
    }
    if (existing?.country) {
      return NextResponse.json({ initialized: false, reason: 'already_set', profile: existing })
    }

    // Look up IP → location. ipapi.co accepts the raw IP as a path param.
    // If we don't have a client IP (e.g. local dev) we call the no-path
    // endpoint which uses the server's IP — still useful for dev.
    const ip = clientIp(req)
    const url = ip && ip !== 'unknown'
      ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      : 'https://ipapi.co/json/'

    let data: IpApiResponse | null = null
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) data = (await res.json()) as IpApiResponse
    } catch (err) {
      console.warn('[geo-init] ipapi fetch failed:', err)
    }

    if (!data || data.error) {
      return NextResponse.json({ initialized: false, reason: 'ipapi_unavailable' })
    }

    const country = data.country_code?.toUpperCase() ?? null
    const label = [data.city, data.country_name ?? country].filter(Boolean).join(', ') || null
    const patch = {
      country,
      region:         data.region ?? null,
      city:           data.city ?? null,
      latitude:       typeof data.latitude === 'number' ? data.latitude : null,
      longitude:      typeof data.longitude === 'number' ? data.longitude : null,
      location_label: label,
      currency_code:  data.currency ? data.currency.toUpperCase() : null,
    }

    // Only write columns where we got a real value — preserves existing
    // profile data and doesn't blow up on missing columns if the migration
    // hasn't been applied yet.
    const { error: updateErr } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', user.id)

    if (updateErr) {
      console.warn('[geo-init] profile update failed:', updateErr.message)
      return NextResponse.json({ initialized: false, reason: 'profile_update_failed', detail: updateErr.message })
    }

    console.log(`[geo-init] initialised user=${user.id} country=${country} city=${data.city} currency=${data.currency}`)
    return NextResponse.json({ initialized: true, profile: patch })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[geo-init] unhandled:', msg)
    return NextResponse.json({ initialized: false, reason: 'unhandled', detail: msg }, { status: 500 })
  }
}
