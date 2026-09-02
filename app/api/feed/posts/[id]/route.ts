export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const INTERNAL_FEED_MARKER_RE = /\n?\n?\[\[FT_(?:MEDIA_URLS|SPOTIFY|TEXT_OVERLAY):[A-Za-z0-9_-]+\]\]/g

function stripInternalFeedMarkers(content: string) {
  return content.replace(INTERNAL_FEED_MARKER_RE, '').trimEnd()
}

function normaliseOptionalHttpUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 2048 || !/^https?:\/\//i.test(trimmed)) return null
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null
  } catch {
    return null
  }
}

function getOwnedMusicBackgroundPath(value: string | null | undefined, userId: string): string | null {
  if (!value) return null
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  if (!configuredUrl) return null

  try {
    const configured = new URL(configuredUrl)
    const parsed = new URL(value)
    const publicPrefix = '/storage/v1/object/public/feed-media/'
    if (parsed.origin !== configured.origin || !parsed.pathname.startsWith(publicPrefix)) return null

    const encodedPath = parsed.pathname.slice(publicPrefix.length)
    const path = encodedPath.split('/').map(segment => decodeURIComponent(segment)).join('/')
    const expectedPrefix = `music-background/${userId}/`
    const segments = path.split('/')
    if (!path.startsWith(expectedPrefix) || segments.length !== 3 || segments.some(segment => !segment || segment === '.' || segment === '..')) {
      return null
    }
    return path
  } catch {
    return null
  }
}

async function removePreviousMusicBackground(
  admin: ReturnType<typeof createAdminClient>,
  previousUrl: string | null | undefined,
  nextUrl: string | null | undefined,
  postId: string,
  userId: string,
) {
  if (!previousUrl || previousUrl === nextUrl) return
  const storagePath = getOwnedMusicBackgroundPath(previousUrl, userId)
  if (!storagePath) return

  // Do not remove an object that another post references. This also keeps
  // pasted/shared public URLs safe; only this feature's own user-scoped
  // `music-background/<userId>/...` objects are eligible for cleanup.
  const { count, error: referenceError } = await admin
    .from('feed_posts')
    .select('id', { count: 'exact', head: true })
    .eq('music_background_url', previousUrl)
    .neq('id', postId)

  if (referenceError) {
    console.warn('[PATCH /api/feed/posts/[id]] could not check old Music background references:', referenceError.message)
    return
  }
  if ((count ?? 0) > 0) return

  const { error: removeError } = await admin.storage.from('feed-media').remove([storagePath])
  if (removeError) {
    console.warn('[PATCH /api/feed/posts/[id]] could not remove old Music background:', removeError.message)
  }
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

    // Resolve ownership before looking at the requested fields. This keeps the
    // permission boundary authoritative for every PATCH shape: a non-owner
    // receives 403 even if they send an invalid or otherwise incomplete body.
    // The admin client is server-only and is used here solely to avoid an
    // RLS-dependent 404 for an authenticated outsider.
    const admin = createAdminClient()
    const { data: post, error: fetchError } = await admin
      .from('feed_posts')
      .select('id, user_id, type, music_background_url')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { content?: unknown; title?: unknown; link_url?: unknown; media_url?: unknown; media_urls?: unknown; music_background_url?: unknown }
    const hasContent = typeof body.content === 'string'
    const hasTitle = typeof body.title === 'string'
    const hasLinkUrl = typeof body.link_url === 'string' || body.link_url === null
    const hasMediaUrl = typeof body.media_url === 'string' || body.media_url === null
    const hasMediaUrls = Array.isArray(body.media_urls)
    const hasMusicBackgroundField = Object.prototype.hasOwnProperty.call(body, 'music_background_url')
    const hasMusicBackground = hasMusicBackgroundField && (typeof body.music_background_url === 'string' || body.music_background_url === null)

    if (hasMusicBackgroundField && !hasMusicBackground) {
      return NextResponse.json({ error: 'music_background_url must be a URL or null' }, { status: 400 })
    }

    if (!hasContent && !hasTitle && !hasLinkUrl && !hasMediaUrl && !hasMediaUrls && !hasMusicBackground) {
      return NextResponse.json({ error: 'content, title, link_url, media, or music background is required' }, { status: 400 })
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
    const musicBackgroundUrl = hasMusicBackground
      ? normaliseOptionalHttpUrl(body.music_background_url)
      : undefined

    if (hasMusicBackground && typeof body.music_background_url === 'string' && body.music_background_url.trim() && !musicBackgroundUrl) {
      return NextResponse.json({ error: 'Music background image URL is invalid' }, { status: 400 })
    }

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

    if (hasMusicBackground && post.type !== 'music') {
      return NextResponse.json({ error: 'Music background editing is only supported for Music posts' }, { status: 400 })
    }

    if (post.type === 'poll') {
      return NextResponse.json({ error: 'Poll posts cannot be edited once live' }, { status: 400 })
    }

    if ((hasMediaUrl || hasMediaUrls) && post.type !== 'photo') {
      return NextResponse.json({ error: 'Media editing is only supported for photo posts' }, { status: 400 })
    }

    const update: { content?: string; title?: string | null; link_url?: string | null; media_url?: string | null; media_type?: string | null; music_background_url?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (content !== undefined) update.content = content
    if (title !== undefined) update.title = title || null
    if (linkUrl !== undefined) update.link_url = linkUrl
    if (mediaUrl !== undefined) {
      update.media_url = mediaUrl
      update.media_type = mediaUrl ? 'image' : null
    }
    if (musicBackgroundUrl !== undefined) update.music_background_url = musicBackgroundUrl

    const { data: updatedPost, error: updateError } = await admin
      .from('feed_posts')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('[PATCH /api/feed/posts/[id]]', updateError)
      return NextResponse.json({ error: 'Failed to edit post' }, { status: 500 })
    }

    if (hasMusicBackground) {
      await removePreviousMusicBackground(
        admin,
        post.music_background_url as string | null | undefined,
        musicBackgroundUrl,
        params.id,
        user.id,
      )
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
