import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/jobs — list active jobs (public)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const jobType     = searchParams.get('type')
    const locType     = searchParams.get('location_type')
    const category    = searchParams.get('category')
    const search      = searchParams.get('search')
    const salaryMin   = searchParams.get('salary_min')

    let query = supabase
      .from('jobs')
      .select('*, poster:profiles!poster_id(id, full_name, bio, created_at)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50)

    if (jobType)   query = query.eq('job_type', jobType)
    if (locType)   query = query.eq('location_type', locType)
    if (category)  query = query.eq('category', category)
    if (salaryMin) query = query.gte('salary_min', parseInt(salaryMin))
    if (search)    query = query.ilike('title', `%${search}%`)

    const { data, error } = await query

    if (error) {
      console.error('[GET /api/jobs]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs: data ?? [] })
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
        salary_currency:      salary_currency ?? 'GBP',
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
