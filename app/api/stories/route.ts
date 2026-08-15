export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyConnectionsNewStory } from '@/lib/notifications/story-fanout'
import type { StoryAuthorGroup, StoryMediaType, StoryRecord } from '@/types/stories'

// GET /api/stories
// Returns the current user's Stories bar: their own stories (if any, even if
// they'd otherwise be hidden) plus non-expired stories from everyone they
// follow, grouped by author with a per-author "hasUnviewed" flag computed
// from the current user's story_views rows. RLS on `stories` already limits
// visibility to (expires_at > now() OR user_id = auth.uid()) — we additionally
// scope to "me + who I follow" here so the bar mirrors the Following feed
// rather than showing every member on the platform.
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: followRows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const authorIds = Array.from(new Set([user.id, ...(followRows ?? []).map(r => r.following_id as string)]))

    const { data: stories, error: storiesErr } = await supabase
      .from('stories')
      .select('id, user_id, media_url, media_type, caption, duration_seconds, created_at, expires_at, saved_as_memory, view_count')
      .in('user_id', authorIds)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (storiesErr) {
      return NextResponse.json({ error: storiesErr.message }, { status: 500 })
    }

    const storyRows = (stories ?? []) as StoryRecord[]
    if (storyRows.length === 0) {
      return NextResponse.json({ groups: [] })
    }

    const storyIds = storyRows.map(s => s.id)
    const [{ data: viewedRows }, { data: profiles }] = await Promise.all([
      supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', storyIds),
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', authorIds),
    ])

    const viewedStoryIds = new Set((viewedRows ?? []).map(r => r.story_id as string))
    const profileById = new Map((profiles ?? []).map(p => [p.id as string, p]))

    const byAuthor = new Map<string, StoryRecord[]>()
    for (const story of storyRows) {
      const list = byAuthor.get(story.user_id) ?? []
      list.push(story)
      byAuthor.set(story.user_id, list)
    }

    const groups: StoryAuthorGroup[] = Array.from(byAuthor.entries()).map(([authorId, authorStories]) => {
      const sorted = [...authorStories].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const profile = profileById.get(authorId)
      return {
        user: {
          id: authorId,
          full_name: (profile?.full_name as string | null) ?? null,
          avatar_url: (profile?.avatar_url as string | null) ?? null,
        },
        stories: sorted,
        hasUnviewed: sorted.some(s => !viewedStoryIds.has(s.id)),
        latestCreatedAt: sorted[sorted.length - 1].created_at,
      }
    })

    // Sort: own group first, then unviewed-first, then most-recent-first within each group.
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
// Body: { media_url, media_type, caption?, duration_seconds? }
// Creates a new story owned by the current user, then fans out a push
// notification (best-effort, awaited so it completes before the serverless
// function is torn down) to opted-in connections.
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
    }

    if (!body.media_url || !body.media_type || !['image', 'video'].includes(body.media_type)) {
      return NextResponse.json({ error: 'media_url and a valid media_type are required' }, { status: 400 })
    }

    const durationSeconds = body.media_type === 'image'
      ? Math.min(Math.max(body.duration_seconds ?? 5, 1), 15)
      : Math.min(Math.max(body.duration_seconds ?? 15, 1), 30)

    const { data: story, error: insertErr } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        media_url: body.media_url,
        media_type: body.media_type,
        caption: body.caption?.slice(0, 500) ?? null,
        duration_seconds: durationSeconds,
      })
      .select('id, user_id, media_url, media_type, caption, duration_seconds, created_at, expires_at, saved_as_memory, view_count')
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
      const admin = createAdminClient()
      const { data: posterProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      await notifyConnectionsNewStory({
        storyId: story.id,
        posterId: user.id,
        posterName: (posterProfile?.full_name as string | null) || 'Someone you follow',
      })
    } catch (fanoutErr) {
      console.error('[POST /api/stories] fanout failed:', fanoutErr instanceof Error ? fanoutErr.message : fanoutErr)
    }

    return NextResponse.json({ story })
  } catch (err) {
    console.error('[POST /api/stories]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
