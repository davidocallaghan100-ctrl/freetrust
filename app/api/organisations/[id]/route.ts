export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeOrgTrustScore,
  collectTrustSignalsForOrg,
} from '@/lib/organisations/trust-score'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Try by UUID first, then by slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const { data, error } = isUUID
      ? await supabase
          .from('organisations')
          .select('*, creator:profiles!creator_id(id, full_name, avatar_url, trust_balance)')
          .eq('id', id)
          .maybeSingle()
      : await supabase
          .from('organisations')
          .select('*, creator:profiles!creator_id(id, full_name, avatar_url, trust_balance)')
          .eq('slug', id)
          .maybeSingle()

    if (error) {
      console.error('[GET /api/organisations/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    // Compute trust score from live signals — mirrors the list
    // endpoint behaviour at app/api/organisations/route.ts:47. Without
    // this override, the detail page displays the raw `trust_score`
    // column from the DB, which is set to 0 on insert and never
    // updated, so every org profile shows ₮0 regardless of actual
    // signals. The list page and detail page now show the same
    // computed value.
    //
    // Wrapped in its own try/catch — a failure in the batched signal
    // helpers (missing table, RLS denial, Supabase 503) falls back
    // to the raw column value rather than 500-ing the whole detail
    // endpoint.
    let trustScore: number | null = null
    try {
      const sig = await collectTrustSignalsForOrg(supabase, data as Record<string, unknown> & { id: string })
      trustScore = computeOrgTrustScore(sig)
    } catch (scoreErr) {
      const msg = scoreErr instanceof Error ? scoreErr.message : String(scoreErr)
      console.error('[GET /api/organisations/[id]] trust_score compute failed, falling back to raw column:', msg)
      trustScore = typeof data.trust_score === 'number' ? data.trust_score : 0
    }

    // Check if current user is following
    const { data: { user } } = await supabase.auth.getUser()
    let isFollowing = false
    if (user) {
      try {
        const { data: follow } = await supabase
          .from('organisation_followers')
          .select('id')
          .eq('organisation_id', data.id)
          .eq('user_id', user.id)
          .maybeSingle()
        isFollowing = !!follow
      } catch {
        isFollowing = false
      }
    }

    return NextResponse.json({
      ...data,
      trust_score: trustScore,
      isFollowing,
      userId: user?.id ?? null,
    })
  } catch (err) {
    console.error('[GET /api/organisations/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/organisations/[id]
// Updates an organisation. Caller must be:
//   - the org creator, OR
//   - an organisation member with role 'admin' or 'owner', OR
//   - a platform admin (profiles.role = 'admin')
// Platform admin and org-member admins use the service-role client to bypass RLS.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const adminClient = createAdminClient()

    // Fetch org
    const { data: org, error: orgErr } = await adminClient
      .from('organisations')
      .select('id, creator_id')
      .eq('id', id)
      .maybeSingle()

    if (orgErr || !org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

    // Check caller's profile role (platform admin)
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isPlatformAdmin = (callerProfile as { role?: string } | null)?.role === 'admin'
    const isCreator = org.creator_id === user.id

    // Check org membership role (org-level admin/owner)
    let isOrgAdmin = false
    if (!isCreator && !isPlatformAdmin) {
      const { data: membership } = await adminClient
        .from('organisation_members')
        .select('role')
        .eq('organisation_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      isOrgAdmin = membership != null && ['admin', 'owner'].includes((membership as { role: string }).role)
    }

    if (!isCreator && !isPlatformAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))

    // Whitelist updatable fields
    const allowed = [
      'name', 'tagline', 'description', 'website', 'location',
      'sector', 'founded_year', 'impact_statement', 'tags',
      'logo_url', 'cover_url', 'investment_intent',
    ]
    const payload: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) payload[key] = body[key]
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Always use admin client for the write — bypasses RLS cleanly
    // since we've already verified authorisation above.
    const { error: updateErr } = await adminClient
      .from('organisations')
      .update(payload)
      .eq('id', id)

    if (updateErr) {
      console.error('[PATCH /api/organisations/[id]]', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/organisations/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/organisations/[id]
// Deletes an organisation. Same access rules as PATCH.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const adminClient = createAdminClient()

    const { data: org, error: orgErr } = await adminClient
      .from('organisations')
      .select('id, creator_id')
      .eq('id', id)
      .maybeSingle()

    if (orgErr || !org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isPlatformAdmin = (callerProfile as { role?: string } | null)?.role === 'admin'
    const isCreator = org.creator_id === user.id

    let isOrgAdmin = false
    if (!isCreator && !isPlatformAdmin) {
      const { data: membership } = await adminClient
        .from('organisation_members')
        .select('role')
        .eq('organisation_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      isOrgAdmin = membership != null && ['admin', 'owner'].includes((membership as { role: string }).role)
    }

    if (!isCreator && !isPlatformAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: deleteErr } = await adminClient
      .from('organisations')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      console.error('[DELETE /api/organisations/[id]]', deleteErr)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/organisations/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
