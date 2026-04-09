export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

// GET /api/communities — list communities (public)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const featured = searchParams.get('featured')

    let query = supabase
      .from('communities')
      .select('*, owner:profiles!owner_id(id, full_name, avatar_url)')
      .eq('is_archived', false)
      .order('is_featured', { ascending: false })
      .order('member_count', { ascending: false })

    if (category) query = query.eq('category', category)
    if (featured === 'true') query = query.eq('is_featured', true)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query

    if (error) {
      console.error('[GET /api/communities]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ communities: data ?? [] })
  } catch (err) {
    console.error('[GET /api/communities] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/communities — create community (auth required)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      name?: string
      slug?: string
      description?: string
      avatar_initials?: string
      avatar_gradient?: string
      category?: string
      tags?: string[]
      is_paid?: boolean
      price_monthly?: number
    }

    const { name, description, avatar_initials, avatar_gradient, category, tags, is_paid, price_monthly } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Community name is required.' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
    }
    if (!category?.trim()) {
      return NextResponse.json({ error: 'Category is required.' }, { status: 400 })
    }
    if (is_paid && (typeof price_monthly !== 'number' || price_monthly < 5)) {
      return NextResponse.json({ error: 'Paid communities require a minimum price of €5/month.' }, { status: 400 })
    }

    // Generate unique slug
    let baseSlug = slugify(name.trim())
    let finalSlug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await supabase
        .from('communities')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle()
      if (!existing) break
      attempt++
      finalSlug = `${baseSlug}-${attempt}`
      if (attempt > 10) {
        finalSlug = `${baseSlug}-${Date.now()}`
        break
      }
    }

    // Insert community
    const { data: community, error: insertError } = await supabase
      .from('communities')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        slug: finalSlug,
        description: description.trim(),
        avatar_initials: avatar_initials ?? name.trim().split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        avatar_gradient: avatar_gradient ?? 'linear-gradient(135deg,#38bdf8,#0284c7)',
        category: category.trim(),
        tags: tags ?? [],
        is_paid: is_paid ?? false,
        price_monthly: is_paid ? (price_monthly ?? 0) : 0,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/communities] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Add owner as member
    await supabase.from('community_members').insert({
      community_id: community.id,
      user_id: user.id,
      role: 'owner',
      tier: 'owner',
    })

    return NextResponse.json({ community }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/communities] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
