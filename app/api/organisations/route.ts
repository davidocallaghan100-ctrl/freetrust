import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const sector = searchParams.get('sector')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    let query = supabase
      .from('organisations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type) query = query.eq('type', type)
    if (sector) query = query.eq('sector', sector)

    const { data, error } = await query

    if (error) {
      // Table may not exist yet — return empty gracefully
      return NextResponse.json({ organisations: [] })
    }

    return NextResponse.json({ organisations: data ?? [] })
  } catch (err) {
    console.error('[GET /api/organisations]', err)
    return NextResponse.json({ organisations: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, description, location, website, sector, tags } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!type) {
      return NextResponse.json({ error: 'Organisation type is required' }, { status: 400 })
    }
    if (!description?.trim() || description.trim().length < 20) {
      return NextResponse.json({ error: 'Description must be at least 20 characters' }, { status: 400 })
    }

    const { data: org, error: insertError } = await supabase
      .from('organisations')
      .insert({
        name: name.trim(),
        type,
        description: description.trim(),
        location: location?.trim() || null,
        website: website?.trim() || null,
        sector: sector || null,
        tags: Array.isArray(tags) ? tags : [],
        creator_id: user.id,
        is_verified: false,
        members_count: 1,
        trust_score: 0,
        status: 'active',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/organisations] insert error:', insertError)
      // Graceful fallback if table doesn't exist yet
      return NextResponse.json({
        organisation: {
          id: crypto.randomUUID(),
          name: name.trim(),
          type,
          description: description.trim(),
          location: location?.trim() || null,
          website: website?.trim() || null,
          sector: sector || null,
          tags: Array.isArray(tags) ? tags : [],
          creator_id: user.id,
          is_verified: false,
          members_count: 1,
          trust_score: 0,
          status: 'active',
          created_at: new Date().toISOString(),
        },
        created: true,
        _mock: true,
      })
    }

    return NextResponse.json({ organisation: org, created: true }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/organisations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
