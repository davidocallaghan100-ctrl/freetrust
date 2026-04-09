export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/businesses — list businesses (with filters)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const offset = (page - 1) * limit
    const search = searchParams.get('q')
    const type = searchParams.get('type')
    const industry = searchParams.get('industry')
    const location = searchParams.get('location')
    const verified = searchParams.get('verified')
    const mine = searchParams.get('mine') === 'true'

    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase
      .from('businesses')
      .select('*, owner:profiles!owner_id(id, full_name, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (mine && user) {
      query = query.eq('owner_id', user.id)
    } else {
      query = query.eq('status', 'active')
    }

    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,industry.ilike.%${search}%`)
    if (type) query = query.eq('business_type', type)
    if (industry) query = query.eq('industry', industry)
    if (location) query = query.ilike('location', `%${location}%`)
    if (verified === 'true') query = query.eq('verified', true)

    const { data: businesses, error, count } = await query

    if (error) {
      console.error('[GET /api/businesses]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ businesses: businesses ?? [], total: count ?? 0, page, limit })
  } catch (err) {
    console.error('[GET /api/businesses] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/businesses — create a business
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      name, business_type, industry, description, mission,
      logo_url, cover_url, website, social_links,
      location, service_area, contact_email, contact_phone,
      vat_number, registration_number, founded_date,
    } = body

    if (!name || !business_type) {
      return NextResponse.json({ error: 'name and business_type are required' }, { status: 400 })
    }

    // Generate slug
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    const { data: business, error } = await supabase
      .from('businesses')
      .insert({
        owner_id: user.id,
        name, slug, business_type, industry,
        description, mission, logo_url, cover_url,
        website, social_links: social_links ?? {},
        location, service_area, contact_email, contact_phone,
        vat_number, registration_number,
        founded_date: founded_date || null,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/businesses]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-add owner as admin member
    await supabase.from('business_members').insert({
      business_id: business.id,
      user_id: user.id,
      role: 'admin',
      title: 'Owner',
    })

    return NextResponse.json({ business }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/businesses] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
