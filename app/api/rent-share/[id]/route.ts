export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rent_share_listings')
      .select('*, owner:profiles!user_id(id, full_name, avatar_url, bio, location, created_at)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ listing: data })
  } catch (err) {
    console.error('[GET /api/rent-share/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('rent_share_listings')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const {
      title, description, category,
      price_per_day, price_per_week, deposit,
      location, images, available_from, available_to, status,
    } = body

    if (!title?.trim() || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    if (!description?.trim() || description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
    }
    if (status && !['active', 'rented', 'inactive'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('rent_share_listings')
      .update({
        title:          title.trim(),
        description:    description.trim(),
        category:       category?.trim() ?? 'Other',
        price_per_day:  price_per_day  ?? null,
        price_per_week: price_per_week ?? null,
        deposit:        deposit        ?? 0,
        location:       location?.trim() ?? null,
        images:         Array.isArray(images) ? images : [],
        available_from: available_from ?? null,
        available_to:   available_to   ?? null,
        status:         status         ?? 'active',
        updated_at:     new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/rent-share/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ listing: data })
  } catch (err) {
    console.error('[PATCH /api/rent-share/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
