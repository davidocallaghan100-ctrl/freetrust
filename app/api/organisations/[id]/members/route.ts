export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/organisations/[id]/members — list members for an org
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Resolve org id (UUID or slug)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let orgId = id
    if (!isUUID) {
      const { data: org } = await supabase
        .from('organisations')
        .select('id')
        .eq('slug', id)
        .maybeSingle()
      if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
      orgId = org.id
    }

    const { data, error } = await supabase
      .from('organisation_members')
      .select(`
        id,
        role,
        title,
        joined_at,
        profile:profiles!user_id (
          id,
          full_name,
          avatar_url,
          username,
          trust_balance,
          avg_rating,
          review_count,
          bio,
          location
        )
      `)
      .eq('organisation_id', orgId)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('[GET /api/organisations/[id]/members]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ members: data ?? [] })
  } catch (err) {
    console.error('[GET /api/organisations/[id]/members] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/organisations/[id]/members — add a member (owner/admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve org id
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let orgId = id
    if (!isUUID) {
      const { data: org } = await supabase
        .from('organisations')
        .select('id')
        .eq('slug', id)
        .maybeSingle()
      if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
      orgId = org.id
    }

    // Verify caller is owner/admin or org creator
    const [membershipResult, orgResult] = await Promise.all([
      supabase.from('organisation_members').select('role').eq('organisation_id', orgId).eq('user_id', user.id).maybeSingle(),
      supabase.from('organisations').select('creator_id').eq('id', orgId).maybeSingle(),
    ])

    const isAuthorized =
      orgResult.data?.creator_id === user.id ||
      membershipResult.data?.role === 'owner' ||
      membershipResult.data?.role === 'admin'

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { user_id, role = 'member', title } = body as { user_id?: string; role?: string; title?: string }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const { data: member, error: insertError } = await admin
      .from('organisation_members')
      .insert({ organisation_id: orgId, user_id, role, title: title || null })
      .select(`
        id, role, title, joined_at,
        profile:profiles!user_id (id, full_name, avatar_url, username, trust_balance)
      `)
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Update members_count (best effort)
    const { count } = await admin
      .from('organisation_members')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId)
    if (count !== null) {
      await admin.from('organisations').update({ members_count: count }).eq('id', orgId)
    }

    return NextResponse.json({ member }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/organisations/[id]/members] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/organisations/[id]/members — remove a member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { user_id } = body as { user_id?: string }
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Only allow self-removal or owner/admin
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const orgId = isUUID ? id : (
      await supabase.from('organisations').select('id').eq('slug', id).maybeSingle()
        .then(({ data }) => data?.id)
    )
    if (!orgId) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

    const { data: callerMembership } = await supabase
      .from('organisation_members')
      .select('role')
      .eq('organisation_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: org } = await supabase.from('organisations').select('creator_id').eq('id', orgId).maybeSingle()

    const canRemove =
      user_id === user.id ||
      org?.creator_id === user.id ||
      callerMembership?.role === 'owner' ||
      callerMembership?.role === 'admin'

    if (!canRemove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await admin.from('organisation_members').delete().eq('organisation_id', orgId).eq('user_id', user_id)

    // Update members_count
    const { count } = await admin
      .from('organisation_members')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId)
    if (count !== null) {
      await admin.from('organisations').update({ members_count: count }).eq('id', orgId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/organisations/[id]/members] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
