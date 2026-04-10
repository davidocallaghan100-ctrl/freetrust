export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/listings — list active listings (public) or all own listings (authenticated)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const offset = (page - 1) * limit
    const category = searchParams.get('category')
    const categoryId = searchParams.get('category_id')
    const serviceMode = searchParams.get('mode') // online | offline | both
    const location = searchParams.get('location')
    const search = searchParams.get('q')
    const mine = searchParams.get('mine') === 'true'

    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase
      .from('listings')
      .select('*, profiles!seller_id(id, full_name, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (mine && user) {
      query = query.eq('seller_id', user.id)
    } else {
      query = query.eq('status', 'active')
    }

    if (category) query = query.eq('category', category)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (serviceMode) query = query.eq('service_mode', serviceMode)
    if (location) query = query.ilike('location', `%${location}%`)
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

    const { data: listings, error, count } = await query

    if (error) {
      console.error('[GET /api/listings]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      listings: listings ?? [],
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    console.error('[GET /api/listings] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/listings — create a new listing
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    const { title, description, price, currency = 'EUR', product_type, category_id, category, service_mode = 'online', location, service_radius, delivery_types = [], tags = [], images = [] } = body

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
    }
    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
    }

    // Ensure product_type is always set so services and products are kept separate
    const resolvedProductType = (typeof product_type === 'string' && product_type.trim())
      ? product_type.trim()
      : 'physical'

    const { data: listing, error } = await supabase
      .from('listings')
      .insert({
        seller_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price,
        currency,
        product_type: resolvedProductType,
        category_id: category_id ?? null,
        category: category ?? null,
        service_mode: service_mode,
        location: location ?? null,
        service_radius: service_radius ?? null,
        delivery_types: Array.isArray(delivery_types) ? delivery_types : [],
        tags: Array.isArray(tags) ? tags : [],
        images: Array.isArray(images) ? images : [],
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/listings]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ listing }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/listings] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
