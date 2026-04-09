import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/businesses/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data: business, error } = await supabase
      .from('businesses')
      .select(`
        *,
        owner:profiles!owner_id(id, full_name, avatar_url, username),
        members:business_members(
          id, role, title, joined_at,
          user:profiles!user_id(id, full_name, avatar_url, username)
        ),
        reviews:business_reviews(
          id, rating, content, created_at,
          reviewer:profiles!reviewer_id(id, full_name, avatar_url)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business })
  } catch (err) {
    console.error('[GET /api/businesses/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/businesses/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    // Verify ownership
    const { data: existing } = await supabase.from('businesses').select('owner_id').eq('id', id).single()
    if (!existing || existing.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const allowed = [
      'name', 'business_type', 'industry', 'description', 'mission',
      'logo_url', 'cover_url', 'website', 'social_links', 'location',
      'service_area', 'contact_email', 'contact_phone', 'vat_number',
      'registration_number', 'founded_date', 'status',
    ]
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ business })
  } catch (err) {
    console.error('[PATCH /api/businesses/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
