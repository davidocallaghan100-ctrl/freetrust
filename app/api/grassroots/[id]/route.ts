export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ────────────────────────────────────────────────────────────────────────────
// /api/grassroots/[id]
// ────────────────────────────────────────────────────────────────────────────
// GET    — single listing with poster profile joined (no auth required)
// PATCH  — update listing (owner only — enforced by RLS + explicit check)
// DELETE — soft delete by setting is_active=false (owner only)

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('grassroots_listings')
      .select(
        'id, created_at, updated_at, user_id, title, description, category, listing_type, ' +
        'rate, rate_type, currency_code, rate_eur, availability, photos, ' +
        'country, region, city, latitude, longitude, location_label, ' +
        'is_active, contact_preference, contact_value, trust_tokens_accepted, status, ' +
        'poster:profiles!user_id(id, full_name, avatar_url, bio, created_at, location, country, city, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url)'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error(`[GET /api/grassroots/${id}]`, error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Cast to a generic row shape — the supabase-js generated types don't
    // know about grassroots_listings yet (the migration hasn't been
    // applied at typecheck time), so the embedded `poster:profiles!user_id`
    // select resolves to GenericStringError.
    const listing = data as unknown as Record<string, unknown>

    // Fetch the poster's trust balance in a second query — it lives in a
    // separate table so we can't join it inline via the PostgREST shorthand.
    let trustBalance = 0
    const posterId = typeof listing.user_id === 'string' ? listing.user_id : null
    if (posterId) {
      const { data: bal } = await supabase
        .from('trust_balances')
        .select('balance')
        .eq('user_id', posterId)
        .maybeSingle()
      trustBalance = bal?.balance ?? 0
    }

    return NextResponse.json(
      { listing, trust_balance: trustBalance },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[GET /api/grassroots/${id}] unhandled:`, msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PATCH — owner updates a subset of editable fields
// ────────────────────────────────────────────────────────────────────────────
const PATCH_ALLOWED = [
  'title', 'description', 'category', 'listing_type',
  'rate', 'rate_type', 'currency_code',
  'availability', 'photos',
  'country', 'region', 'city', 'latitude', 'longitude', 'location_label',
  'contact_preference', 'contact_value', 'trust_tokens_accepted',
  'is_active', 'status',
] as const

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the existing row so we can confirm ownership before writing.
    // The RLS policy would block the update anyway, but an explicit 403 is
    // friendlier to the client than a silent 0-row response.
    const { data: existing, error: fetchErr } = await supabase
      .from('grassroots_listings')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr) {
      console.error(`[PATCH /api/grassroots/${id}] fetch`, fetchErr.message)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    for (const key of PATCH_ALLOWED) {
      if (key in body) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    if (typeof updates.country === 'string') {
      updates.country = (updates.country as string).toUpperCase()
    }
    if (typeof updates.currency_code === 'string') {
      updates.currency_code = (updates.currency_code as string).toUpperCase()
    }

    const admin = createAdminClient()
    const { data: updated, error: updErr } = await admin
      .from('grassroots_listings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .single()
    if (updErr) {
      console.error(`[PATCH /api/grassroots/${id}]`, updErr.message)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: updated?.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[PATCH /api/grassroots/${id}] unhandled:`, msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DELETE — soft delete (is_active=false). Owner only.
// Hard delete is intentionally not exposed here — use the Supabase admin
// UI or a dedicated GDPR erasure endpoint if needed.
// ────────────────────────────────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('grassroots_listings')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      console.error(`[DELETE /api/grassroots/${id}]`, error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[DELETE /api/grassroots/${id}] unhandled:`, msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
