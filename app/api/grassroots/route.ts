export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GRASSROOTS_CATEGORIES_BY_SLUG } from '@/lib/grassroots/categories'
import { toPgUrlArray } from '@/lib/supabase/text-array'

// ────────────────────────────────────────────────────────────────────────────
// /api/grassroots
// ────────────────────────────────────────────────────────────────────────────
//
// GET  — public list with location-aware filtering (same query param shape
//        as /api/jobs and /api/events so the browse page can reuse the
//        shared LocationFilter component patterns).
// POST — create a new grassroots listing (auth required). Also writes a
//        canonical EUR-normalised `rate_eur` via the frankfurter.app API
//        so browse queries can sort/filter on a single currency.

// EUR rate cache shared across requests in the same Node instance.
// Identity fallback if Frankfurter is unreachable.
const EUR_MULTIPLIER_CACHE = new Map<string, { mult: number; at: number }>()
const RATE_TTL_MS = 60 * 60 * 1000

async function toEur(amount: number, fromCurrency: string | null | undefined): Promise<number> {
  if (!Number.isFinite(amount)) return 0
  const from = (fromCurrency ?? 'EUR').toUpperCase()
  if (from === 'EUR' || amount === 0) return Math.round(amount * 100) / 100

  const cached = EUR_MULTIPLIER_CACHE.get(from)
  if (cached && Date.now() - cached.at < RATE_TTL_MS) {
    return Math.round(amount * cached.mult * 100) / 100
  }
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=EUR`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`frankfurter ${res.status}`)
    const d = await res.json() as { rates?: { EUR?: number } }
    const mult = d.rates?.EUR
    if (typeof mult !== 'number' || !(mult > 0)) throw new Error('bad rate')
    EUR_MULTIPLIER_CACHE.set(from, { mult, at: Date.now() })
    return Math.round(amount * mult * 100) / 100
  } catch {
    return Math.round(amount * 100) / 100
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET
// ────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const category     = searchParams.get('category')
    const city         = searchParams.get('city')
    const country      = searchParams.get('country')
    const latParam     = searchParams.get('lat')
    const lngParam     = searchParams.get('lng')
    const radiusParam  = searchParams.get('radius_km')
    const listingType  = searchParams.get('listing_type')
    const availability = searchParams.get('availability')
    const status       = searchParams.get('status') ?? 'active'
    const trustOnly    = searchParams.get('trust_tokens') === 'true'

    const lat = latParam ? Number(latParam) : null
    const lng = lngParam ? Number(lngParam) : null
    const radius = radiusParam ? Number(radiusParam) : 0
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng)

    let query = supabase
      .from('grassroots_listings')
      .select(
        'id, created_at, updated_at, user_id, title, description, category, listing_type, ' +
        'rate, rate_type, currency_code, rate_eur, availability, photos, ' +
        'country, region, city, latitude, longitude, location_label, ' +
        'is_active, contact_preference, contact_value, trust_tokens_accepted, status, ' +
        'poster:profiles!user_id(id, full_name, avatar_url, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url)'
      )
      .eq('is_active', true)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(200)

    if (category)     query = query.eq('category', category)
    if (country)      query = query.eq('country', country.toUpperCase())
    if (city)         query = query.ilike('city', `%${city}%`)
    if (listingType)  query = query.eq('listing_type', listingType)
    if (availability) query = query.eq('availability', availability)
    if (trustOnly)    query = query.eq('trust_tokens_accepted', true)

    const { data, error } = await query
    if (error) {
      console.error('[GET /api/grassroots]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Cast to a generic row shape — the supabase-js generated types don't
    // know about grassroots_listings yet (the migration hasn't been
    // applied at typecheck time), so the embedded `poster:profiles!user_id`
    // select resolves to GenericStringError. This is the same untyped-row
    // pattern services/products/events use throughout the codebase.
    let listings: Record<string, unknown>[] = (data ?? []) as unknown as Record<string, unknown>[]

    // Client-side haversine sort + optional radius filter. Matches the
    // pattern used by /api/jobs and /api/events — fine at <=200 rows and
    // avoids needing a PostGIS extension.
    if (hasGeo && lat !== null && lng !== null) {
      listings = listings.map(l => {
        const lLat = typeof l.latitude  === 'number' ? l.latitude  : null
        const lLng = typeof l.longitude === 'number' ? l.longitude : null
        if (lLat == null || lLng == null) return { ...l, distance_km: null }
        const dLat = ((lLat - lat) * Math.PI) / 180
        const dLng = ((lLng - lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) * Math.cos((lLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return { ...l, distance_km: dist }
      })
      if (radius > 0) {
        listings = listings.filter(
          l => typeof l.distance_km === 'number' && (l.distance_km as number) <= radius
        )
      }
      // Sort: nearest first
      listings = listings.sort((a, b) => {
        const da = typeof a.distance_km === 'number' ? a.distance_km : Number.MAX_VALUE
        const db = typeof b.distance_km === 'number' ? b.distance_km : Number.MAX_VALUE
        return da - db
      })
    }

    return NextResponse.json({ listings }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/grassroots] unhandled:', msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST — create
// ────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as {
      title?:       string
      description?: string
      category?:    string
      listing_type?: 'offering' | 'seeking'
      rate?:        number | string | null
      rate_type?:   'hourly' | 'daily' | 'fixed' | 'negotiable'
      currency_code?: string
      availability?: 'immediate' | 'this_week' | 'this_month' | 'flexible'
      photos?:      string[]
      country?:     string | null
      region?:      string | null
      city?:        string | null
      latitude?:    number | null
      longitude?:   number | null
      location_label?: string | null
      contact_preference?: 'platform' | 'whatsapp' | 'phone' | 'email'
      contact_value?: string | null
      trust_tokens_accepted?: boolean
    } | null

    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const title = (body.title ?? '').trim()
    const description = (body.description ?? '').trim()
    const category = (body.category ?? '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!category) return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    if (!GRASSROOTS_CATEGORIES_BY_SLUG[category]) {
      return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 })
    }

    const listingType = body.listing_type === 'seeking' ? 'seeking' : 'offering'
    const rateType    = body.rate_type && ['hourly','daily','fixed','negotiable'].includes(body.rate_type)
      ? body.rate_type : 'hourly'
    const availability = body.availability && ['immediate','this_week','this_month','flexible'].includes(body.availability)
      ? body.availability : 'flexible'
    const contactPref = body.contact_preference && ['platform','whatsapp','phone','email'].includes(body.contact_preference)
      ? body.contact_preference : 'platform'

    const currencyCode = (body.currency_code ?? 'EUR').toUpperCase()
    const rateNum = body.rate != null && body.rate !== '' ? Number(body.rate) : null
    const rateEur = rateNum != null && Number.isFinite(rateNum) ? await toEur(rateNum, currencyCode) : null

    // Use the admin client to write so we bypass any policy surprises if
    // the session cookie isn't perfectly in sync. The user_id is still
    // forced to auth.getUser().id so this is safe.
    const admin = createAdminClient()
    const { data: inserted, error } = await admin
      .from('grassroots_listings')
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        category,
        listing_type: listingType,
        rate: rateNum,
        rate_type: rateType,
        currency_code: currencyCode,
        rate_eur: rateEur,
        availability,
        // Encode photos as a Postgres text[] literal via the shared
        // helper so the insert works around PostgREST's JSON→text[]
        // coercion bug. toPgUrlArray also filters to http(s) URLs only,
        // so we no longer need the manual .filter + .slice — cap the
        // array size to 10 here instead.
        photos: toPgUrlArray(Array.isArray(body.photos) ? body.photos.slice(0, 10) : []),
        country: body.country ? body.country.toUpperCase() : null,
        region: body.region ?? null,
        city: body.city ?? null,
        latitude:  typeof body.latitude  === 'number' ? body.latitude  : null,
        longitude: typeof body.longitude === 'number' ? body.longitude : null,
        location_label: body.location_label ?? null,
        contact_preference: contactPref,
        contact_value: body.contact_value?.trim() || null,
        trust_tokens_accepted: Boolean(body.trust_tokens_accepted),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[POST /api/grassroots]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: inserted?.id, success: true }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/grassroots] unhandled:', msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
