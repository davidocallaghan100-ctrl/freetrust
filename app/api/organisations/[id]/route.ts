export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
