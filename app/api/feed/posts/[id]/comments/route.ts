export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: comments, error } = await supabase
      .from('feed_comments')
      .select(`
        id, content, created_at,
        profiles!feed_comments_user_id_fkey(id, full_name, avatar_url)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('feed comments GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    return NextResponse.json({ comments: comments ?? [] })
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

    if (!content) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }

    const { data: comment, error: insertError } = await supabase
      .from('feed_comments')
      .insert({ post_id: id, user_id: user.id, content })
      .select(`
        id, content, created_at,
        profiles!feed_comments_user_id_fkey(id, full_name, avatar_url)
      `)
      .single()

    if (insertError) {
      console.error('feed_comments insert error:', insertError)
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    // Increment comments_count
    const { data: postData } = await supabase
      .from('feed_posts')
      .select('comments_count')
      .eq('id', id)
      .single()

    if (postData) {
      await supabase
        .from('feed_posts')
        .update({ comments_count: (postData.comments_count ?? 0) + 1 })
        .eq('id', id)
    }

    return NextResponse.json({ success: true, comment })
  } catch (err) {
    console.error('POST comment error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
