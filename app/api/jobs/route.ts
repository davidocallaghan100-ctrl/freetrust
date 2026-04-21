export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardTrust } from '@/lib/trust/award'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ── API key auth for external job ingestion ──────────────────────────────────
//
// Set JOBS_API_KEY in Vercel → Project Settings → Environment Variables.
// External callers POST with:  x-api-key: <JOBS_API_KEY>
// When authenticated this way, jobs are posted under the admin (system) account.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/jobs — list active jobs (public)
//
// Location-aware query params:
//   ?country=IE            Filter by ISO country code
//   ?city=Cork             Filter by city (ilike)
//   ?lat=51.9&lng=-8.5     User latitude/longitude for proximity sort
//   ?radius_km=50          Return only jobs within N km of lat/lng
//   ?remote=true           Include remote jobs
//   ?remote_only=true      Return ONLY remote jobs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const jobType     = searchParams.get('type')
    const locType     = searchParams.get('location_type')
    const category    = searchParams.get('category')
    const search      = searchParams.get('search')
    const salaryMin   = searchParams.get('salary_min')

    const country    = searchParams.get('country')
    const city       = searchParams.get('city')
    const latParam   = searchParams.get('lat')
    const lngParam   = searchParams.get('lng')
    const radiusParam= searchParams.get('radius_km')
    const remote     = searchParams.get('remote')
    const remoteOnly = searchParams.get('remote_only') === 'true'

    const lat = latParam ? Number(latParam) : null
    const lng = lngParam ? Number(lngParam) : null
    const radius = radiusParam ? Number(radiusParam) : 0
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng)

    let query = supabase
      .from('jobs')
      .select('*, poster:profiles!poster_id(id, full_name, bio, created_at, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)

    if (jobType)   query = query.eq('job_type', jobType)
    if (locType)   query = query.eq('location_type', locType)
    if (category)  query = query.eq('category', category)
    if (salaryMin) query = query.gte('salary_min', parseInt(salaryMin))
    if (search)    query = query.ilike('title', `%${search}%`)
    if (country)   query = query.ilike('country', country)
    if (city)      query = query.ilike('city', `%${city}%`)
    if (remoteOnly) query = query.eq('is_remote', true)

    const { data, error } = await query
    if (error) {
      console.error('[GET /api/jobs]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Client-side haversine sort + filter so we don't need PostGIS or
    // custom RPCs on the Supabase side. Fine at <=100 rows.
    let jobs = data ?? []
    if (hasGeo && lat !== null && lng !== null) {
      jobs = jobs.map((j: Record<string, unknown>) => {
        const jLat = typeof j.latitude === 'number' ? j.latitude : null
        const jLng = typeof j.longitude === 'number' ? j.longitude : null
        if (jLat == null || jLng == null) {
          return { ...j, distance_km: (j.is_remote ? 0 : null) }
        }
        const dLat = ((jLat - lat) * Math.PI) / 180
        const dLng = ((jLng - lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) * Math.cos((jLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return { ...j, distance_km: dist }
      })
      if (radius > 0) {
        jobs = jobs.filter((j: Record<string, unknown>) => {
          if (remote === 'true' && j.is_remote) return true
          const d = j.distance_km
          return typeof d === 'number' && d <= radius
        })
      }
      // Sort: remote jobs last, local first by distance
      jobs = jobs.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aR = a.is_remote ? 1 : 0
        const bR = b.is_remote ? 1 : 0
        if (aR !== bR) return aR - bR
        const da = typeof a.distance_km === 'number' ? a.distance_km : Number.MAX_VALUE
        const db = typeof b.distance_km === 'number' ? b.distance_km : Number.MAX_VALUE
        return da - db
      })
    }

    return NextResponse.json({ jobs })
  } catch (err) {
    console.error('[GET /api/jobs] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/jobs — create job
//
// Auth: Supabase JWT (Authorization: Bearer <token>)  — poster_id = authenticated user
//   OR: API key (x-api-key: <JOBS_API_KEY>)           — poster_id = admin system account
//
// For the API key path, jobs are attributed to the admin user
// (davidocallaghan100@gmail.com) so the poster relationship is always valid.
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient()

    // ── Auth: check JWT (cookie or Authorization header), then API key ──────
    let posterId: string | null = null
    let isApiKeyAuth = false

    // 1. Try cookie-based session (standard SSR flow)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      posterId = user.id
    }

    // 2. Fallback: Authorization Bearer header (sent explicitly by the client
    //    as a belt-and-suspenders measure when cookie propagation may be unreliable)
    if (!posterId) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          const bearerClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          })
          const { data: { user: bearerUser } } = await bearerClient.auth.getUser(token)
          if (bearerUser) {
            posterId = bearerUser.id
          }
        } catch {
          // Bearer auth failed — fall through to API key check
        }
      }
    }

    // 3. Try API key auth (for automated/external job ingestion)
    if (!posterId) {
      const apiKey = request.headers.get('x-api-key')
      const expectedKey = process.env.JOBS_API_KEY
      if (expectedKey && apiKey && apiKey === expectedKey) {
        // Look up the admin user to use as the system poster
        const { data: adminProfile } = await admin
          .from('profiles')
          .select('id')
          .eq('email', 'davidocallaghan100@gmail.com')
          .maybeSingle()
        if (adminProfile?.id) {
          posterId = adminProfile.id
          isApiKeyAuth = true
        }
      }
    }

    if (!posterId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      requirements,
      job_type,
      location_type,
      location,
      category,
      tags,
      salary_min,
      salary_max,
      salary_currency,
      application_deadline,
      // Company / business details
      company_name,
      company_logo_url,
      company_website,
      company_size,
      company_description,
      // Extended fields for API key ingestion
      country,
      city,
      region,
      is_remote,
      latitude,
      longitude,
      location_label,
      currency_code,
      salary_min_eur,
      salary_max_eur,
    } = body

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }
    if (!job_type || !['full_time', 'part_time', 'contract', 'freelance'].includes(job_type)) {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 })
    }
    if (!location_type || !['remote', 'hybrid', 'on_site'].includes(location_type)) {
      return NextResponse.json({ error: 'Invalid location type' }, { status: 400 })
    }
    if (!category?.trim()) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    // Use admin client for writes so RLS can't block API-key-authenticated posts
    const { data: job, error: insertError } = await admin
      .from('jobs')
      .insert({
        poster_id:            posterId,
        title:                title.trim(),
        description:          description.trim(),
        requirements:         requirements?.trim() ?? null,
        job_type,
        location_type,
        location:             location?.trim() ?? null,
        category:             category.trim(),
        tags:                 Array.isArray(tags) ? tags : [],
        salary_min:           salary_min ?? null,
        salary_max:           salary_max ?? null,
        salary_currency:      salary_currency ?? 'EUR',
        application_deadline: application_deadline ?? null,
        status:               'active',
        // Company / business details
        company_name:         company_name?.trim() ?? null,
        company_logo_url:     company_logo_url ?? null,
        company_website:      company_website?.trim() ?? null,
        company_size:         company_size ?? null,
        company_description:  company_description?.trim() ?? null,
        // Extended geo/currency fields
        country:              country ?? null,
        city:                 city ?? null,
        region:               region ?? null,
        is_remote:            is_remote ?? (location_type === 'remote'),
        latitude:             latitude ?? null,
        longitude:            longitude ?? null,
        location_label:       location_label ?? null,
        currency_code:        currency_code ?? salary_currency ?? 'EUR',
        salary_min_eur:       salary_min_eur ?? null,
        salary_max_eur:       salary_max_eur ?? null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/jobs]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Award ₮ for posting a job — skip for API key (system) posts
    let trustAwarded = 0
    if (!isApiKeyAuth) {
      const jobRow = job as { id?: string; title?: string } | null
      const trustResult = await awardTrust({
        userId: posterId,
        amount: TRUST_REWARDS.CREATE_JOB,
        type:   TRUST_LEDGER_TYPES.CREATE_JOB,
        ref:    jobRow?.id ?? null,
        desc:   `Posted job: ${jobRow?.title ?? 'Untitled'}`,
      })
      trustAwarded = trustResult.ok ? trustResult.amount : 0
    }

    return NextResponse.json({ job, trustAwarded }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
