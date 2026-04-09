export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/businesses/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Try businesses table first
    const { data: business } = await supabase
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
      .maybeSingle()

    if (business) {
      return NextResponse.json({ business })
    }

    // Fall back to organisations table — map fields to business shape
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const { data: org } = isUUID
      ? await supabase.from('organisations').select('*, creator:profiles!creator_id(id, full_name, avatar_url, username)').eq('id', id).maybeSingle()
      : await supabase.from('organisations').select('*, creator:profiles!creator_id(id, full_name, avatar_url, username)').eq('slug', id).maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Map org fields to the business interface the page expects
    const mapped = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      business_type: org.type ?? 'Organisation',
      industry: org.sector ?? '',
      description: org.description ?? '',
      mission: org.impact_statement ?? '',
      logo_url: org.logo_url ?? null,
      cover_url: org.cover_url ?? null,
      website: org.website ?? null,
      social_links: {},
      location: org.location ?? null,
      service_area: null,
      contact_email: null,
      contact_phone: null,
      vat_number: null,
      founded_date: org.founded_year ? `${org.founded_year}-01-01` : null,
      verified: org.is_verified ?? false,
      verification_status: org.is_verified ? 'verified' : 'unverified',
      trust_score: org.trust_score ?? 0,
      follower_count: 0,
      created_at: org.created_at,
      tagline: org.tagline ?? null,
      tags: org.tags ?? [],
      size: org.size ?? null,
      owner: org.creator ?? null,
      members: [],
      reviews: [],
    }

    return NextResponse.json({ business: mapped })
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
