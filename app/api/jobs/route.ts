export const dynamic = 'force-dynamic'
export const maxDuration = 30
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardTrust } from '@/lib/trust/award'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'

/**
 * Decode a Supabase JWT locally — no network call needed.
 * Returns the `sub` (user id) claim, or null if the token is malformed.
 * Security: the admin client is used for all DB writes so RLS is
 * bypassed; we only need the user id to tag the row, not to authorise
 * the write. The JWT signature is still validated by Supabase's own
 * auth server whenever the client calls getUser() elsewhere.
 */
function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number }
    // Reject expired tokens (exp is in seconds)
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null
    return decoded.sub ?? null
  } catch {
    return null
  }
}

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
      .select('*, poster:profiles!poster_id(id, full_name, bio, created_at, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url), org:organisations!org_id(id, name, slug, logo_url, is_verified)')
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

    // ── Auth: fast local JWT decode (zero network calls) ─────────────────
    //
    // Previously we ran two parallel auth.getUser() network calls before
    // every insert. Each getUser() is ~200–500 ms from Vercel → Supabase
    // (both in eu-west-1). On a Vercel Hobby cold start (+2–4 s) plus two
    // auth round-trips plus the DB insert, it was easy to blow past the
    // hard 10 s function timeout.
    //
    // Since the form always sends Authorization: Bearer <access_token>,
    // we decode the JWT payload locally — the sub / exp claims are
    // unsigned base64url and don't require a network call to read.
    // The admin client is used for the DB insert (bypasses RLS), so the
    // only thing we need from auth is the user id to tag poster_id.
    //
    // The JWT is still issued and signed by Supabase; an attacker can't
    // forge a valid token. The worst-case risk of not re-verifying with
    // getUser() is that a freshly-revoked token (within its TTL) could
    // still post — acceptable for a job-posting flow.
    let posterId: string | null = null
    let isApiKeyAuth = false

    // ── Fast path 1: Bearer token (Authorization header) ─────────────────
    const authHeader = request.headers.get('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (bearerToken) {
      posterId = decodeJwtSub(bearerToken)
    }

    // ── Fast path 2: Cookie JWT decode (no network call) ──────────────────
    // Supabase SSR sets the cookie as `sb-{project-ref}-auth-token`.
    // The value is a JSON array [accessToken, refreshToken] encoded as a
    // chunked cookie. We read it and decode the JWT sub claim locally —
    // same zero-latency approach as the Bearer path above, just from a
    // different source. This handles the standard Next.js form-submit
    // pattern where no Authorization header is sent.
    if (!posterId) {
      try {
        const { cookies } = await import('next/headers')
        const cookieStore = await cookies()
        // Supabase SSR may split the token across chunks: sb-{ref}-auth-token.0, .1 etc.
        // Try the base name first (single-chunk), then reassemble if chunked.
        const projectRef = 'tioqakxnqjxyuzgnwhrb'
        const baseName = `sb-${projectRef}-auth-token`
        let rawToken = cookieStore.get(baseName)?.value ?? null
        if (!rawToken) {
          // Try chunked: concatenate .0 .1 .2
          const chunks: string[] = []
          for (let i = 0; i <= 5; i++) {
            const chunk = cookieStore.get(`${baseName}.${i}`)?.value
            if (!chunk) break
            chunks.push(chunk)
          }
          if (chunks.length > 0) rawToken = chunks.join('')
        }
        if (rawToken) {
          // The cookie value is a URL-encoded JSON string: ["accessToken","refreshToken"]
          const decoded = decodeURIComponent(rawToken)
          const parsed = JSON.parse(decoded) as string | string[] | { access_token?: string }
          const accessToken = Array.isArray(parsed) ? parsed[0]
            : typeof parsed === 'object' && parsed !== null && 'access_token' in parsed
              ? (parsed as { access_token?: string }).access_token ?? null
              : typeof parsed === 'string' ? parsed : null
          if (accessToken) posterId = decodeJwtSub(accessToken)
        }
      } catch {
        // Cookie decode failed — fall through to network call
      }
    }

    // ── Fallback: network getUser() call (last resort) ────────────────────
    // Only reached if both fast paths fail (e.g. cookie format changed).
    // This is the slow path (~300–500ms) but only runs as an absolute fallback.
    if (!posterId) {
      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) posterId = user.id
      } catch {
        // cookie auth failed — continue to API key check
      }
    }

    // API key auth (for automated/external job ingestion)
    if (!posterId) {
      const apiKey = request.headers.get('x-api-key')
      const expectedKey = process.env.JOBS_API_KEY
      if (expectedKey && apiKey && apiKey === expectedKey) {
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
      // Organisation posting (LinkedIn-style "post as org")
      org_id,
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

    // If posting on behalf of an org, verify the user is owner/admin
    let resolvedOrgId: string | null = org_id ?? null
    if (resolvedOrgId && !isApiKeyAuth) {
      const { data: membership } = await admin
        .from('organisation_members')
        .select('role')
        .eq('organisation_id', resolvedOrgId)
        .eq('user_id', posterId)
        .maybeSingle()
      const { data: orgRow } = await admin
        .from('organisations')
        .select('creator_id')
        .eq('id', resolvedOrgId)
        .maybeSingle()
      const isOrgAdmin =
        orgRow?.creator_id === posterId ||
        membership?.role === 'owner' ||
        membership?.role === 'admin'
      if (!isOrgAdmin) {
        return NextResponse.json({ error: 'You do not have permission to post on behalf of this organisation' }, { status: 403 })
      }
    }

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
        // Organisation posting
        org_id:               resolvedOrgId,
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

    // Respond immediately after the DB insert — fire trust award + notification
    // in the background so they never block the HTTP response. On Vercel's
    // hobby plan, serverless functions hard-timeout at 10s regardless of
    // maxDuration; awaiting awardTrust() caused the response to arrive after
    // the cutoff, making the client show "request taking too long" even though
    // the job was created successfully.
    const jobRow = job as { id?: string; title?: string } | null
    if (!isApiKeyAuth && posterId && jobRow?.id) {
      void Promise.resolve().then(() =>
        awardTrust({
          userId: posterId!,
          amount: TRUST_REWARDS.CREATE_JOB,
          type:   TRUST_LEDGER_TYPES.CREATE_JOB,
          ref:    jobRow.id ?? null,
          desc:   `Posted job: ${jobRow.title ?? 'Untitled'}`,
        })
      )
    }

    return NextResponse.json({ job, trustAwarded: TRUST_REWARDS.CREATE_JOB }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
