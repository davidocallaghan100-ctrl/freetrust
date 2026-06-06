export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const INTERNAL_FEED_MARKER_RE = /\n?\n?\[\[FT_(?:MEDIA_URLS|SPOTIFY|TEXT_OVERLAY):[A-Za-z0-9_-]+\]\]/g

function stripInternalFeedMarkers(content: string) {
  return content.replace(INTERNAL_FEED_MARKER_RE, '').trimEnd()
}

// PATCH /api/feed/posts/[id] — edit a post (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { content?: unknown; title?: unknown; link_url?: unknown; media_url?: unknown; media_urls?: unknown }
    const hasContent = typeof body.content === 'string'
    const hasTitle = typeof body.title === 'string'
    const hasLinkUrl = typeof body.link_url === 'string' || body.link_url === null
    const hasMediaUrl = typeof body.media_url === 'string' || body.media_url === null
    const hasMediaUrls = Array.isArray(body.media_urls)

    if (!hasContent && !hasTitle && !hasLinkUrl && !hasMediaUrl && !hasMediaUrls) {
      return NextResponse.json({ error: 'content, title, link_url, or media is required' }, { status: 400 })
    }

    const content = hasContent ? (body.content as string).trim() : undefined
    const title = hasTitle ? (body.title as string).trim() : undefined
    const linkUrl = hasLinkUrl
      ? (typeof body.link_url === 'string' && body.link_url.trim().startsWith('http') ? body.link_url.trim() : null)
      : undefined
    const mediaUrls = hasMediaUrls
      ? Array.from(new Set((body.media_urls as unknown[])
          .filter((value): value is string => typeof value === 'string')
          .map(url => url.trim())
          .filter(url => /^https?:\/\//i.test(url))))
          .slice(0, 10)
      : undefined
    const mediaUrl = hasMediaUrl
      ? (typeof body.media_url === 'string' && /^https?:\/\//i.test(body.media_url.trim()) ? body.media_url.trim() : null)
      : (mediaUrls !== undefined ? (mediaUrls[0] ?? null) : undefined)

    // Photo posts store edit-only metadata (multi-photo URLs, Spotify preview data,
    // and text-overlay settings) as hidden markers in `content`. The user-visible
    // caption can be well below 5000 chars while those hidden markers push the raw
    // string over the limit, especially after adding photos. Count only the visible
    // text so valid photo edits are not rejected with a misleading length error.
    if (content !== undefined && stripInternalFeedMarkers(content).length > 5000) {
      return NextResponse.json({ error: 'Post too long (max 5000 chars)' }, { status: 400 })
    }

    if (title !== undefined && title.length > 200) {
      return NextResponse.json({ error: 'Title too long (max 200 chars)' }, { status: 400 })
    }

    // Verify the post belongs to this user before editing
    const { data: post, error: fetchError } = await supabase
      .from('feed_posts')
      .select('id, user_id, type')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (post.type === 'poll') {
      return NextResponse.json({ error: 'Poll posts cannot be edited once live' }, { status: 400 })
    }

    if ((hasMediaUrl || hasMediaUrls) && post.type !== 'photo') {
      return NextResponse.json({ error: 'Media editing is only supported for photo posts' }, { status: 400 })
    }

    const update: { content?: string; title?: string | null; link_url?: string | null; media_url?: string | null; media_type?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (content !== undefined) update.content = content
    if (title !== undefined) update.title = title || null
    if (linkUrl !== undefined) update.link_url = linkUrl
    if (mediaUrl !== undefined) {
      update.media_url = mediaUrl
      update.media_type = mediaUrl ? 'image' : null
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from('feed_posts')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('[PATCH /api/feed/posts/[id]]', updateError)
      return NextResponse.json({ error: 'Failed to edit post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: updatedPost })
  } catch (err) {
    console.error('[PATCH /api/feed/posts/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/feed/posts/[id] — delete a post (owner only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the post belongs to this user before deleting
    const { data: post, error: fetchError } = await supabase
      .from('feed_posts')
      .select('id, user_id')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('feed_posts')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('[DELETE /api/feed/posts/[id]]', deleteError)
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/feed/posts/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
