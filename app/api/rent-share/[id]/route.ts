export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    // Verify ownership (admins can edit any listing)
    const { data: existing } = await supabase
      .from('rent_share_listings')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (!isAdmin && existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

    // Use admin client to bypass RLS when an admin is editing someone else's listing
    const db = isAdmin ? createAdminClient() : supabase

    const { data, error } = await db
      .from('rent_share_listings')
      .update({
        title:          title.trim(),
        description:    description.trim(),
        category:       category?.trim() ?? 'Other',
        price_per_day:  (price_per_day != null && price_per_day !== '') ? Number(price_per_day) : null,
        price_per_week: (price_per_week != null && price_per_week !== '') ? Number(price_per_week) : null,
        deposit:        (deposit != null && deposit !== '') ? Number(deposit) : 0,
        location:       location?.trim() || null,
        images:         (() => {
          const urls: string[] = Array.isArray(images)
            ? images.filter((u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
            : []
          return urls.length === 0
            ? '{}'
            : '{' + urls.map(u => '"' + u.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + '}'
        })(),
        available_from: available_from || null,
        available_to:   available_to   || null,
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin — admins can delete any listing
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      // Verify ownership
      const { data: existing } = await supabase
        .from('rent_share_listings')
        .select('user_id')
        .eq('id', id)
        .single()
      if (!existing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      if (existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase.from('rent_share_listings').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/rent-share/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
