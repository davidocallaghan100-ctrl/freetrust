export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/push/sendPushNotification'
import { gifPreviewLabel } from '@/lib/gifs'

async function canPostAsOrganisation(admin: ReturnType<typeof createAdminClient>, userId: string, organisationId: string) {
  const { data: membership } = await admin
    .from('organisation_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organisation_id', organisationId)
    .in('role', ['owner', 'admin'])
    .maybeSingle()

  if (membership) return true

  const { data: created } = await admin
    .from('organisations')
    .select('id')
    .eq('id', organisationId)
    .eq('creator_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  return Boolean(created)
}

type CrossTableReference = {
  itemType: 'article' | 'service'
  itemId: string
}

type CrossTableTarget = CrossTableReference & {
  ownerId: string
  canonicalUrl: string
}

type CommentRecord = {
  id: string
  content: string
  user_id?: string | null
  created_at: string
  updated_at?: string | null
  like_count?: number
  liked_by_me?: boolean
  [key: string]: unknown
}

const COMMENT_SELECT = `
  id, content, user_id, created_at, updated_at, posted_as_organisation_id,
  profiles!feed_item_comments_user_id_fkey(id, full_name, avatar_url),
  posted_as_organisation:organisations!feed_item_comments_posted_as_organisation_id_fkey(id, name, slug, logo_url)
`

function parseCrossTableReference(postId: string): CrossTableReference | null {
  if (postId.startsWith('article-')) return { itemType: 'article', itemId: postId.slice('article-'.length) }
  if (postId.startsWith('service-')) return { itemType: 'service', itemId: postId.slice('service-'.length) }
  return null
}

async function resolveCrossTableTarget(
  admin: ReturnType<typeof createAdminClient>,
  reference: CrossTableReference,
): Promise<CrossTableTarget | null> {
  if (reference.itemType === 'article') {
    const { data } = await admin
      .from('articles')
      .select('id, author_id, slug')
      .eq('id', reference.itemId)
      .eq('status', 'published')
      .maybeSingle()

    if (!data?.author_id || !data.slug) return null
    return {
      ...reference,
      ownerId: data.author_id,
      canonicalUrl: `/articles/${data.slug}`,
    }
  }

  const { data } = await admin
    .from('listings')
    .select('id, seller_id')
    .eq('id', reference.itemId)
    .eq('product_type', 'service')
    .eq('status', 'active')
    .maybeSingle()

  if (!data?.seller_id) return null
  return {
    ...reference,
    ownerId: data.seller_id,
    canonicalUrl: `/services/${data.id}`,
  }
}

async function enrichCommentEngagement(
  admin: ReturnType<typeof createAdminClient>,
  comments: CommentRecord[],
  likesTable: 'feed_comment_likes' | 'feed_item_comment_likes',
  currentUserId: string | null,
) {
  if (comments.length === 0) return comments

  const commentIds = comments.map(comment => comment.id)
  const { data: likes, error } = await admin
    .from(likesTable)
    .select('comment_id, user_id')
    .in('comment_id', commentIds)

  if (error) {
    // Keep comments readable during a rolling migration. The like endpoint
    // still reports a real error rather than pretending a write succeeded.
    console.warn(`[feed/comments] ${likesTable} lookup skipped:`, error.message)
  }

  const counts: Record<string, number> = {}
  const likedByMe = new Set<string>()
  for (const row of (likes ?? []) as Array<{ comment_id: string; user_id: string }>) {
    counts[row.comment_id] = (counts[row.comment_id] ?? 0) + 1
    if (currentUserId && row.user_id === currentUserId) likedByMe.add(row.comment_id)
  }

  return comments.map(comment => ({
    ...comment,
    like_count: counts[comment.id] ?? 0,
    liked_by_me: likedByMe.has(comment.id),
  }))
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    const crossTableReference = parseCrossTableReference(id)
    if (crossTableReference) {
      const target = await resolveCrossTableTarget(admin, crossTableReference)
      if (!target) return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })

      const { data: comments, error } = await admin
        .from('feed_item_comments')
        .select(COMMENT_SELECT)
        .eq('item_type', target.itemType)
        .eq('item_id', target.itemId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('feed item comments GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
      }

      const enriched = await enrichCommentEngagement(
        admin,
        (comments ?? []) as CommentRecord[],
        'feed_item_comment_likes',
        user?.id ?? null,
      )
      return NextResponse.json({ comments: enriched })
    }

    const { data: comments, error } = await supabase
      .from('feed_comments')
      .select(`
        id, content, user_id, created_at, updated_at, posted_as_organisation_id,
        profiles!feed_comments_user_id_fkey(id, full_name, avatar_url),
        posted_as_organisation:organisations!feed_comments_posted_as_organisation_id_fkey(id, name, slug, logo_url)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('feed comments GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    const enriched = await enrichCommentEngagement(
      admin,
      (comments ?? []) as CommentRecord[],
      'feed_comment_likes',
      user?.id ?? null,
    )
    return NextResponse.json({ comments: enriched })
  } catch (err) {
    console.error('GET comments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const content = (body?.content ?? '').trim()
    const postedAsOrganisationId = typeof body?.posted_as_organisation_id === 'string' && body.posted_as_organisation_id.trim()
      ? body.posted_as_organisation_id.trim()
      : null

    if (!content) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }

    if (content.length > 500) {
      return NextResponse.json({ error: 'Comment must be under 500 characters' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (postedAsOrganisationId) {
      const allowed = await canPostAsOrganisation(admin, user.id, postedAsOrganisationId)
      if (!allowed) {
        return NextResponse.json({ error: 'You are not allowed to comment as this page' }, { status: 403 })
      }
    }

    const crossTableReference = parseCrossTableReference(id)
    if (crossTableReference) {
      const target = await resolveCrossTableTarget(admin, crossTableReference)
      if (!target) return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })

      const { data: comment, error: insertError } = await admin
        .from('feed_item_comments')
        .insert({
          item_type: target.itemType,
          item_id: target.itemId,
          user_id: user.id,
          content,
          posted_as_organisation_id: postedAsOrganisationId,
        })
        .select(COMMENT_SELECT)
        .single()

      if (insertError) {
        console.error('feed_item_comments insert error:', insertError)
        return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
      }

      const [enriched] = await enrichCommentEngagement(
        admin,
        [comment as CommentRecord],
        'feed_item_comment_likes',
        user.id,
      )

      // Keep side-table comments consistent with normal feed comments: notify
      // the article author/service seller, but never notify the commenter.
      if (target.ownerId !== user.id) {
        let commenterName = 'Someone'
        if (postedAsOrganisationId) {
          const { data: org } = await admin
            .from('organisations')
            .select('name')
            .eq('id', postedAsOrganisationId)
            .maybeSingle()
          commenterName = org?.name ?? 'A page'
        } else {
          const { data: commenter } = await admin
            .from('profiles')
            .select('full_name, username')
            .eq('id', user.id)
            .maybeSingle()
          commenterName = commenter?.full_name ?? commenter?.username ?? 'Someone'
        }
        const preview = content.length > 200 ? `${content.slice(0, 200)}…` : content
        sendEmail({
          type: 'new_comment',
          userId: target.ownerId,
          payload: { commenterName, preview, postId: id },
        }).catch(() => {})
        sendPushNotification({
          userId: target.ownerId,
          title: `New comment on your ${target.itemType}`,
          message: `${commenterName}: "${preview}"`,
          url: target.canonicalUrl,
        }).catch(() => {})
      }

      return NextResponse.json({ success: true, comment: enriched })
    }

    const { data: comment, error: insertError } = await supabase
      .from('feed_comments')
      .insert({ post_id: id, user_id: user.id, content, posted_as_organisation_id: postedAsOrganisationId })
      .select(`
        id, content, user_id, created_at, updated_at, posted_as_organisation_id,
        profiles!feed_comments_user_id_fkey(id, full_name, avatar_url),
        posted_as_organisation:organisations!feed_comments_posted_as_organisation_id_fkey(id, name, slug, logo_url)
      `)
      .single()

    if (insertError) {
      console.error('feed_comments insert error:', insertError)
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    // Increment comments_count + email the post author (if not self)
    const { data: postData } = await supabase
      .from('feed_posts')
      .select('user_id, comments_count')
      .eq('id', id)
      .single()

    if (postData) {
      await supabase
        .from('feed_posts')
        .update({ comments_count: (postData.comments_count ?? 0) + 1 })
        .eq('id', id)

      // Email the post author (preference-checked, skip self-comments)
      if (postData.user_id && postData.user_id !== user.id) {
        let commenterName = 'Someone'
        if (postedAsOrganisationId) {
          const { data: org } = await admin
            .from('organisations')
            .select('name')
            .eq('id', postedAsOrganisationId)
            .maybeSingle()
          commenterName = org?.name ?? 'A page'
        } else {
          const { data: commenter } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle()
          commenterName = commenter?.full_name ?? 'Someone'
        }
        const cleanPreview = gifPreviewLabel(content, content)
        const preview = cleanPreview.length > 200 ? cleanPreview.slice(0, 200) + '…' : cleanPreview
        sendEmail({
          type: 'new_comment',
          userId: postData.user_id,
          payload: { commenterName, preview, postId: id },
        }).catch(() => {})

        // Push notification (fire-and-forget)
        sendPushNotification({
          userId: postData.user_id,
          title: 'New comment on your post',
          message: `${commenterName}: "${preview}"`,
          url: `/feed/${id}`,
        }).catch(() => {})
      }
    }

    const [enriched] = await enrichCommentEngagement(
      admin,
      [comment as CommentRecord],
      'feed_comment_likes',
      user.id,
    )
    return NextResponse.json({ success: true, comment: enriched })
  } catch (err) {
    console.error('POST comment error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
