export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toPgUrlArray, toPgTagArray } from '@/lib/supabase/text-array'

// GET /api/listings/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { data: listing, error } = await supabase
      .from('listings')
      .select('*, profiles!seller_id(id, full_name, avatar_url, bio)')
      .eq('id', params.id)
      .single()

    if (error || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Increment view count (fire-and-forget)
    supabase
      .from('listings')
      .update({ views: (listing.views ?? 0) + 1 })
      .eq('id', params.id)
      .then(() => {})

    return NextResponse.json({ listing })
  } catch (err) {
    console.error('[GET /api/listings/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/listings/[id]
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const allowed = ['title', 'description', 'price', 'status', 'tags', 'images', 'category_id'] as const
    type AllowedKey = typeof allowed[number]
    const updates: Partial<Record<AllowedKey, unknown>> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    // Encode text[] columns as Postgres array literals to dodge the
    // PostgREST JSON→text[] coercion bug. Only re-encode if the field
    // was actually present in the body — otherwise we'd reset the
    // column to '{}' on every PATCH, nuking whatever was stored.
    // See lib/supabase/text-array.ts for the bug history.
    if ('tags' in updates)   updates.tags   = toPgTagArray(updates.tags)
    if ('images' in updates) updates.images = toPgUrlArray(updates.images)

    const { data: listing, error } = await supabase
      .from('listings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('seller_id', user.id) // ensure ownership
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!listing) {
      return NextResponse.json({ error: 'Not found or not authorised' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch (err) {
    console.error('[PATCH /api/listings/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/listings/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin — admins can delete any listing
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    let query = supabase.from('listings').delete().eq('id', params.id)
    if (!isAdmin) query = query.eq('seller_id', user.id)

    const { error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/listings/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
