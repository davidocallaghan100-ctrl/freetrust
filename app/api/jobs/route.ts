export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/jobs — list active jobs (public)
//
// Location-aware query params (new):
//   ?country=IE            Filter by ISO country code
//   ?city=Cork             Filter by city (ilike)
//   ?lat=51.9&lng=-8.5     User latitude/longitude for proximity sort
//   ?radius_km=50          Return only jobs within N km of lat/lng
//   ?remote=true           Include remote jobs
//   ?remote_only=true      Return ONLY remote jobs
//
// When lat/lng is provided, the haversine_km() SQL helper is used to
// sort + optionally filter by distance. Remote jobs bypass the distance
// filter so worldwide contractors still show up for local searches.
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
    if (country)   query = query.eq('country', country.toUpperCase())
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

// POST /api/jobs — create job (auth required)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
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

    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert({
        poster_id:            user.id,
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
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/jobs]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
