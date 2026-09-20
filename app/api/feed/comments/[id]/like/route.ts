export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/feed/comments/[id]/like — toggle like on a comment
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Comments on articles/services are stored in the side-table because the
    // regular feed_comment_likes.comment_id FK points at feed_comments. Look
    // up the side table first; if there is no matching row, keep the original
    // feed_posts comment path below unchanged.
    const { data: sideComment } = await admin
      .from('feed_item_comments')
      .select('id, user_id, item_type, item_id, content')
      .eq('id', commentId)
      .maybeSingle()

    if (sideComment) {
      const { data: existing, error: existingError } = await admin
        .from('feed_item_comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingError) {
        console.error('[side comment like] lookup error:', existingError)
        return NextResponse.json({ error: 'Could not read comment like' }, { status: 500 })
      }

      if (existing) {
        const { error: deleteError } = await admin
          .from('feed_item_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id)
        if (deleteError) {
          console.error('[side comment like] unlike error:', deleteError)
          return NextResponse.json({ error: 'Could not remove comment like' }, { status: 500 })
        }
        const { count } = await admin
          .from('feed_item_comment_likes')
          .select('id', { count: 'exact', head: true })
          .eq('comment_id', commentId)
        return NextResponse.json({ liked: false, like_count: count ?? 0 })
      }

      const { error: insertError } = await admin
        .from('feed_item_comment_likes')
        .insert({ comment_id: commentId, user_id: user.id })
      if (insertError) {
        console.error('[side comment like] like error:', insertError)
        return NextResponse.json({ error: 'Could not like comment' }, { status: 500 })
      }

      const { count } = await admin
        .from('feed_item_comment_likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', commentId)

      if (sideComment.user_id && sideComment.user_id !== user.id) {
        const { data: likerProfile } = await admin
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .maybeSingle()
        const likerName = likerProfile?.full_name ?? likerProfile?.username ?? 'Someone'
        const itemType = sideComment.item_type === 'article' ? 'article' : 'service'

        await admin.from('notifications').insert({
          user_id: sideComment.user_id,
          type: 'comment_like',
          title: `${likerName} liked your comment`,
          body: `"${sideComment.content?.slice(0, 60) ?? 'your comment'}"`,
          data: {
            comment_id: commentId,
            post_id: `${itemType}-${sideComment.item_id}`,
            item_type: itemType,
            item_id: sideComment.item_id,
            liker_id: user.id,
            liker_name: likerName,
          },
          read: false,
        })
      }

      return NextResponse.json({ liked: true, like_count: count ?? 1 })
    }

    // Check if already liked
    const { data: existing } = await admin
      .from('feed_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Unlike
      await admin.from('feed_comment_likes').delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
      // Decrement like_count
      const { data: cur } = await admin.from('feed_comments').select('like_count').eq('id', commentId).maybeSingle()
      if (cur) {
        await admin.from('feed_comments').update({ like_count: Math.max(0, (cur.like_count ?? 1) - 1) }).eq('id', commentId)
      }
      return NextResponse.json({ liked: false })
    }

    // Like
    await admin.from('feed_comment_likes')
      .insert({ comment_id: commentId, user_id: user.id })
    // Increment like_count
    const { data: cur } = await admin.from('feed_comments').select('like_count').eq('id', commentId).maybeSingle()
    if (cur) {
      await admin.from('feed_comments').update({ like_count: (cur.like_count ?? 0) + 1 }).eq('id', commentId)
    }

    // Get comment to find its author & post_id for notification
    const { data: comment } = await admin
      .from('feed_comments')
      .select('user_id, post_id, content')
      .eq('id', commentId)
      .maybeSingle()

    // Send notification to comment author (not self-notification)
    if (comment && comment.user_id && comment.user_id !== user.id) {
      // Get liker's name
      const { data: likerProfile } = await admin
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .maybeSingle()

      const likerName = likerProfile?.full_name ?? likerProfile?.username ?? 'Someone'
      const preview = comment.content?.slice(0, 60) ?? 'your comment'

      await admin.from('notifications').insert({
        user_id: comment.user_id,
        type: 'comment_like',
        title: `${likerName} liked your comment`,
        body: `"${preview}"`,
        data: {
          comment_id: commentId,
          post_id: comment.post_id,
          liker_id: user.id,
          liker_name: likerName,
        },
        read: false,
      })
    }

    return NextResponse.json({ liked: true })
  } catch (err) {
    console.error('[POST /api/feed/comments/[id]/like]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
