export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const category = searchParams.get('category')
    const search   = searchParams.get('search')
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    let query = supabase
      .from('rent_share_listings')
      .select('*, owner:profiles!user_id(id, full_name, avatar_url)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (category && category !== 'All') query = query.eq('category', category)
    if (search) query = query.ilike('title', `%${search}%`)

    const { data, error } = await query
    if (error) {
      // Table doesn't exist yet — return empty rather than crashing the page
      if (error.code === 'PGRST205' || error.message?.includes('rent_share_listings')) {
        console.warn('[GET /api/rent-share] Table not yet created — run: npm run setup:rent-share')
        return NextResponse.json({ listings: [], _setup_required: true })
      }
      console.error('[GET /api/rent-share]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ listings: data ?? [] })
  } catch (err) {
    console.error('[GET /api/rent-share]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      title, description, category,
      price_per_day, price_per_week, deposit,
      location, images, available_from, available_to,
    } = body

    if (!title?.trim() || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    if (!description?.trim() || description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
    }
    if (!category?.trim()) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('rent_share_listings')
      .insert({
        user_id:       user.id,
        title:         title.trim(),
        description:   description.trim(),
        category:      category.trim(),
        price_per_day: price_per_day ?? null,
        price_per_week: price_per_week ?? null,
        deposit:       deposit ?? 0,
        location:      location?.trim() ?? null,
        images:        Array.isArray(images) ? images : [],
        available_from: available_from ?? null,
        available_to:  available_to ?? null,
        status:        'active',
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/rent-share]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ listing: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/rent-share]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
