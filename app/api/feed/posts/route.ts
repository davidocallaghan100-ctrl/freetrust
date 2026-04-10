export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') ?? 'discover'
    const type = searchParams.get('type') ?? 'all'
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = 20
    const offset = (page - 1) * limit

    let query = supabase
      .from('feed_posts')
      .select(`
        id, user_id, type, content, media_url, media_type, title, link_url,
        trust_reward, likes_count, comments_count, saves_count, views_count, created_at,
        profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, trust_balance)
      `)

    if (type !== 'all') {
      query = query.eq('type', type)
    }

    if (tab === 'trending') {
      query = query.order('likes_count', { ascending: false })
    } else if (tab === 'following' && user) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const ids = (following ?? []).map((f: { following_id: string }) => f.following_id)
      if (ids.length > 0) {
        query = query.in('user_id', ids).order('created_at', { ascending: false })
      } else {
        return NextResponse.json({ posts: [], hasMore: false })
      }
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: posts, error } = await query

    if (error) {
      console.error('[feed/posts GET]', error)
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    let likedIds: string[] = []
    let savedIds: string[] = []
    const commentCountMap: Record<string, number> = {}

    if (posts && posts.length > 0) {
      const postIds = posts.map((p: { id: string }) => p.id)

      const [likesRes, savesRes, commentsRes] = await Promise.all([
        user ? supabase.from('feed_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] }),
        user ? supabase.from('feed_saves').select('post_id').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] }),
        supabase.from('feed_comments').select('post_id').in('post_id', postIds),
      ])

      likedIds = ((likesRes as { data: { post_id: string }[] | null }).data ?? []).map((l) => l.post_id)
      savedIds = ((savesRes as { data: { post_id: string }[] | null }).data ?? []).map((s) => s.post_id)

      // Build real-time comment count from actual rows
      ;((commentsRes.data ?? []) as { post_id: string }[]).forEach((c) => {
        commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1
      })
    }

    const enriched = (posts ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      comments_count: commentCountMap[p.id as string] ?? 0,
      liked: likedIds.includes(p.id as string),
      saved: savedIds.includes(p.id as string),
    }))

    return NextResponse.json({ posts: enriched, hasMore: enriched.length === limit })
  } catch (err) {
    console.error('[feed/posts GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const content = (body?.content ?? '').trim()
    const type = (body?.type ?? 'text').trim()
    const media_url = body?.media_url ?? null
    const media_type = body?.media_type ?? null
    const title = body?.title ?? null
    const link_url = body?.link_url ?? null

    if (!content && !media_url) {
      return NextResponse.json({ error: 'Content or media required' }, { status: 400 })
    }

    const { data: post, error: insertError } = await supabase
      .from('feed_posts')
      .insert({ user_id: user.id, type, content, media_url, media_type, title, link_url })
      .select(`
        id, user_id, type, content, media_url, media_type, title, link_url,
        trust_reward, likes_count, comments_count, saves_count, views_count, created_at,
        profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, trust_balance)
      `)
      .single()

    if (insertError) {
      console.error('[feed/posts POST]', insertError)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post })
  } catch (err) {
    console.error('[feed/posts POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
