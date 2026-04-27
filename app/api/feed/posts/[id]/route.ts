export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const body = await request.json().catch(() => ({})) as { content?: unknown; title?: unknown }
    const hasContent = typeof body.content === 'string'
    const hasTitle = typeof body.title === 'string'

    if (!hasContent && !hasTitle) {
      return NextResponse.json({ error: 'content or title is required' }, { status: 400 })
    }

    const content = hasContent ? (body.content as string).trim() : undefined
    const title = hasTitle ? (body.title as string).trim() : undefined

    if (content !== undefined && content.length > 5000) {
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

    const update: { content?: string; title?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (content !== undefined) update.content = content
    if (title !== undefined) update.title = title || null

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
