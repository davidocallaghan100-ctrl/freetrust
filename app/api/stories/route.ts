export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyConnectionsNewStory, notifyOrgFollowersNewStory } from '@/lib/notifications/story-fanout'
import type { StoryAuthorGroup, StoryMediaType, StoryRecord } from '@/types/stories'

// GET /api/stories
// Returns the current user's Stories bar: their own personal stories (if
// any), non-expired personal stories from everyone they follow, AND
// non-expired organisation stories from orgs they follow or manage — all
// grouped and sorted together in one bar. RLS on `stories` already limits
// visibility to (expires_at > now() OR user_id = auth.uid()); we additionally
// scope "which authors/orgs" here so the bar mirrors the Following feed
// rather than showing every member/org on the platform.
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: followRows }, { data: orgFollowRows }, { data: orgMemberRows }] = await Promise.all([
      supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
      supabase.from('organisation_follows').select('organisation_id').eq('user_id', user.id),
      supabase.from('organisation_members').select('organisation_id, role').eq('user_id', user.id).in('role', ['owner', 'admin']),
    ])

    const authorIds = Array.from(new Set([user.id, ...(followRows ?? []).map(r => r.following_id as string)]))
    const manageableOrgIds = new Set((orgMemberRows ?? []).map(r => r.organisation_id as string))
    const orgIds = Array.from(new Set([
      ...(orgFollowRows ?? []).map(r => r.organisation_id as string),
      ...Array.from(manageableOrgIds),
    ]))

    // Personal stories (posted_as_organisation_id IS NULL) from me + who I
    // follow, OR org stories from orgs I follow/manage. Built as a single
    // .or() filter so RLS + this scoping apply in one query.
    let query = supabase
      .from('stories')
      .select('id, user_id, media_url, media_type, caption, duration_seconds, created_at, expires_at, saved_as_memory, view_count, posted_as_organisation_id, shared_post_id, shared_post_snapshot')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    const personalFilter = `and(posted_as_organisation_id.is.null,user_id.in.(${authorIds.join(',')}))`
    if (orgIds.length > 0) {
      query = query.or(`${personalFilter},posted_as_organisation_id.in.(${orgIds.join(',')})`)
    } else {
      query = query.or(personalFilter)
    }

    const { data: stories, error: storiesErr } = await query

    if (storiesErr) {
      return NextResponse.json({ error: storiesErr.message }, { status: 500 })
    }

    const storyRows = (stories ?? []) as StoryRecord[]
    if (storyRows.length === 0) {
      return NextResponse.json({ groups: [] })
    }

    const storyIds = storyRows.map(s => s.id)
    const posterIds = Array.from(new Set(storyRows.map(s => s.user_id)))
    const storyOrgIds = Array.from(new Set(
      storyRows.map(s => s.posted_as_organisation_id).filter((id): id is string => !!id)
    ))

    const [{ data: viewedRows }, { data: profiles }, { data: orgRows }] = await Promise.all([
      supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', storyIds),
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', posterIds),
      storyOrgIds.length > 0
        ? supabase.from('organisations').select('id, name, logo_url').in('id', storyOrgIds)
        : Promise.resolve({ data: [] as { id: string; name: string; logo_url: string | null }[] }),
    ])

    const viewedStoryIds = new Set((viewedRows ?? []).map(r => r.story_id as string))
    const profileById = new Map((profiles ?? []).map(p => [p.id as string, p]))
    const orgById = new Map((orgRows ?? []).map(o => [o.id as string, o as { id: string; name: string; logo_url: string | null }]))

    // Group key: the org id when it's an org story, otherwise the poster's
    // user id — this is what makes org stories from different team members
    // collapse into a single org bubble.
    const byGroupKey = new Map<string, StoryRecord[]>()
    for (const story of storyRows) {
      const key = story.posted_as_organisation_id ?? story.user_id
      const list = byGroupKey.get(key) ?? []
      // Denormalize the posting member's display name onto org stories only
      // (used for the "Posted by [name]" line in the viewer).
      if (story.posted_as_organisation_id) {
        const posterProfile = profileById.get(story.user_id)
        story.posted_by_name = (posterProfile?.full_name as string | null) ?? null
      }
      list.push(story)
      byGroupKey.set(key, list)
    }

    const groups: StoryAuthorGroup[] = Array.from(byGroupKey.entries()).map(([key, groupStories]) => {
      const sorted = [...groupStories].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const isOrgGroup = !!sorted[0].posted_as_organisation_id
      if (isOrgGroup) {
        const org = orgById.get(key)
        return {
          user: {
            id: key,
            full_name: org?.name ?? 'Organisation',
            avatar_url: org?.logo_url ?? null,
          },
          org: { id: key, name: org?.name ?? 'Organisation', logo_url: org?.logo_url ?? null },
          canManage: manageableOrgIds.has(key),
          stories: sorted,
          hasUnviewed: sorted.some(s => !viewedStoryIds.has(s.id)),
          latestCreatedAt: sorted[sorted.length - 1].created_at,
        } satisfies StoryAuthorGroup
      }
      const profile = profileById.get(key)
      return {
        user: {
          id: key,
          full_name: (profile?.full_name as string | null) ?? null,
          avatar_url: (profile?.avatar_url as string | null) ?? null,
        },
        canManage: key === user.id,
        stories: sorted,
        hasUnviewed: sorted.some(s => !viewedStoryIds.has(s.id)),
        latestCreatedAt: sorted[sorted.length - 1].created_at,
      } satisfies StoryAuthorGroup
    })

    // Sort: own personal group first, then unviewed-first, then most-recent-first.
    groups.sort((a, b) => {
      if (a.user.id === user.id) return -1
      if (b.user.id === user.id) return 1
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime()
    })

    return NextResponse.json({ groups })
  } catch (err) {
    console.error('[GET /api/stories]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stories
// Body: { media_url, media_type, caption?, duration_seconds?, organisation_id? }
// Creates a new story owned by the current user (audit trail always the real
// poster), optionally posted under an organisation's identity if
// organisation_id is provided and the caller has an owner/admin role for
// that org (checked here AND enforced again by RLS at the DB layer — same
// two-layer pattern as /api/create/publish's org check).
// Fans out a push notification (best-effort, awaited so it completes before
// the serverless function is torn down): personal stories notify the
// poster's opted-in connections; org stories notify the org's opted-in
// followers instead (never both).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as {
      media_url?: string
      media_type?: StoryMediaType
      caption?: string
      duration_seconds?: number
      organisation_id?: string
    }

    if (!body.media_url || !body.media_type || !['image', 'video'].includes(body.media_type)) {
      return NextResponse.json({ error: 'media_url and a valid media_type are required' }, { status: 400 })
    }

    const durationSeconds = body.media_type === 'image'
      ? Math.min(Math.max(body.duration_seconds ?? 5, 1), 15)
      : Math.min(Math.max(body.duration_seconds ?? 15, 1), 30)

    const admin = createAdminClient()

    // ── Post-as-organisation auth check (mirrors /api/create/publish) ──────
    let postedAsOrganisationId: string | null = null
    let orgName = ''
    if (body.organisation_id) {
      const orgId = body.organisation_id
      const { data: membership } = await admin
        .from('organisation_members')
        .select('role')
        .eq('organisation_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle()
      const isAuthorised = membership?.role === 'owner' || membership?.role === 'admin'
      if (!isAuthorised) {
        console.warn('[POST /api/stories] user', user.id, 'tried to post story as org', orgId, '— not authorised')
        return NextResponse.json({ error: 'You are not authorised to post a story as that organisation' }, { status: 403 })
      }
      const { data: org } = await admin.from('organisations').select('name').eq('id', orgId).maybeSingle()
      orgName = (org?.name as string | null) || 'This organisation'
      postedAsOrganisationId = orgId
    }

    const { data: story, error: insertErr } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        media_url: body.media_url,
        media_type: body.media_type,
        caption: body.caption?.slice(0, 500) ?? null,
        duration_seconds: durationSeconds,
        posted_as_organisation_id: postedAsOrganisationId,
      })
      .select('id, user_id, media_url, media_type, caption, duration_seconds, created_at, expires_at, saved_as_memory, view_count, posted_as_organisation_id')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Best-effort push fanout — resolve the poster's display name via the
    // admin client so a slow/failed profile lookup never blocks the response
    // past this point, but still await the fanout itself so it completes
    // before the function returns (Vercel serverless functions are frozen
    // right after the response is sent).
    try {
      if (postedAsOrganisationId) {
        await notifyOrgFollowersNewStory({
          storyId: story.id,
          orgId: postedAsOrganisationId,
          orgName,
        })
      } else {
        const { data: posterProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        await notifyConnectionsNewStory({
          storyId: story.id,
          posterId: user.id,
          posterName: (posterProfile?.full_name as string | null) || 'Someone you follow',
        })
      }
    } catch (fanoutErr) {
      console.error('[POST /api/stories] fanout failed:', fanoutErr instanceof Error ? fanoutErr.message : fanoutErr)
    }

    return NextResponse.json({ story })
  } catch (err) {
    console.error('[POST /api/stories]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
