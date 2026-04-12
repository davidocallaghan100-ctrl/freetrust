export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Shape returned to the client — matches FeedPost in components/PostCard
type FeedItem = {
  id: string
  user_id: string | null
  type: string
  content: string | null
  media_url: string | null
  media_type: string | null
  title: string | null
  link_url: string | null
  trust_reward?: number | null
  likes_count: number
  comments_count: number
  saves_count: number
  views_count: number
  created_at: string
  profiles: { id: string; full_name: string | null; avatar_url: string | null; trust_balance?: number | null } | null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    // The frontend sends `filter`; legacy callers may send `tab`/`type`
    const filter = (searchParams.get('filter') ?? searchParams.get('tab') ?? 'all').toLowerCase()
    const legacyType = searchParams.get('type')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = 20
    const offset = (page - 1) * limit

    // ── Side-table filters: query a different table and map to FeedItem ─────
    if (filter === 'articles') {
      return await fetchArticles(supabase, offset, limit)
    }
    if (filter === 'services') {
      return await fetchServices(supabase, offset, limit)
    }
    if (filter === 'jobs') {
      return await fetchJobs(supabase, offset, limit)
    }
    if (filter === 'events') {
      return await fetchEvents(supabase, offset, limit)
    }

    // ── feed_posts query (all / photos / videos / trending / following) ─────
    let query = supabase
      .from('feed_posts')
      .select(`
        id, user_id, type, content, media_url, media_type, title, link_url,
        trust_reward, likes_count, comments_count, saves_count, views_count, created_at,
        profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, trust_balance)
      `)

    if (filter === 'photos') {
      // Posts with image media — type='photo' or media_type='image'
      query = query.or('type.eq.photo,media_type.eq.image')
    } else if (filter === 'videos') {
      // Posts with video media — type in (video, short) or media_type='video'
      query = query.or('type.eq.video,type.eq.short,media_type.eq.video')
    } else if (filter === 'trending') {
      // Posts from the last 24h, ordered by engagement (likes + comments)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      query = query
        .gte('created_at', since)
        .order('likes_count', { ascending: false })
        .order('comments_count', { ascending: false })
    } else if (filter === 'following' && user) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const ids = (following ?? []).map((f: { following_id: string }) => f.following_id)
      if (ids.length > 0) {
        query = query.in('user_id', ids)
      } else {
        return NextResponse.json({ posts: [], hasMore: false })
      }
    } else if (legacyType && legacyType !== 'all') {
      // Backward compat with the old `type` param
      query = query.eq('type', legacyType)
    }
    // 'all' falls through with no extra filter

    if (filter !== 'trending') {
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

// ── Side-table fetchers ────────────────────────────────────────────────────
// Each one queries a different table and maps the result to the FeedItem shape
// so PostCard can render them without changes.

type SupabaseLike = Awaited<ReturnType<typeof createClient>>

async function fetchArticles(supabase: SupabaseLike, offset: number, limit: number) {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      id, author_id, title, slug, excerpt, body, featured_image_url,
      clap_count, comment_count, created_at, published_at,
      author:profiles!author_id(id, full_name, avatar_url, trust_balance)
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[feed/posts articles]', error.message)
    return NextResponse.json({ posts: [], hasMore: false })
  }

  const items: FeedItem[] = (data ?? []).map((a: Record<string, unknown>) => ({
    id: `article-${a.id}`,
    user_id: a.author_id as string,
    type: 'article',
    content: (a.excerpt as string) ?? null,
    media_url: (a.featured_image_url as string) ?? null,
    media_type: a.featured_image_url ? 'image' : null,
    title: a.title as string,
    link_url: `/articles/${a.slug}`,
    likes_count: Number(a.clap_count ?? 0),
    comments_count: Number(a.comment_count ?? 0),
    saves_count: 0,
    views_count: 0,
    created_at: (a.published_at as string) ?? (a.created_at as string),
    profiles: Array.isArray(a.author) ? (a.author[0] ?? null) : ((a.author as FeedItem['profiles']) ?? null),
  }))

  return NextResponse.json({ posts: items, hasMore: items.length === limit })
}

async function fetchServices(supabase: SupabaseLike, offset: number, limit: number) {
  const { data, error } = await supabase
    .from('services')
    .select(`
      id, seller_id, title, description, category, price, currency, cover_image, created_at,
      seller:profiles!seller_id(id, full_name, avatar_url, trust_balance)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[feed/posts services]', error.message)
    return NextResponse.json({ posts: [], hasMore: false })
  }

  const items: FeedItem[] = (data ?? []).map((s: Record<string, unknown>) => ({
    id: `service-${s.id}`,
    user_id: s.seller_id as string,
    type: 'service',
    content: (s.description as string) ?? null,
    media_url: (s.cover_image as string) ?? null,
    media_type: s.cover_image ? 'image' : null,
    title: s.title as string,
    link_url: `/services/${s.id}`,
    likes_count: 0,
    comments_count: 0,
    saves_count: 0,
    views_count: 0,
    created_at: s.created_at as string,
    profiles: Array.isArray(s.seller) ? (s.seller[0] ?? null) : ((s.seller as FeedItem['profiles']) ?? null),
  }))

  return NextResponse.json({ posts: items, hasMore: items.length === limit })
}

async function fetchJobs(supabase: SupabaseLike, offset: number, limit: number) {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, poster_id, title, description, job_type, location_type, location,
      salary_min, salary_max, salary_currency, category, created_at,
      poster:profiles!poster_id(id, full_name, avatar_url, trust_balance)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[feed/posts jobs]', error.message)
    return NextResponse.json({ posts: [], hasMore: false })
  }

  const items: FeedItem[] = (data ?? []).map((j: Record<string, unknown>) => ({
    id: `job-${j.id}`,
    user_id: j.poster_id as string,
    type: 'job',
    content: (j.description as string) ?? null,
    media_url: null,
    media_type: null,
    title: j.title as string,
    link_url: `/jobs/${j.id}`,
    likes_count: 0,
    comments_count: 0,
    saves_count: 0,
    views_count: 0,
    created_at: j.created_at as string,
    profiles: Array.isArray(j.poster) ? (j.poster[0] ?? null) : ((j.poster as FeedItem['profiles']) ?? null),
  }))

  return NextResponse.json({ posts: items, hasMore: items.length === limit })
}

async function fetchEvents(supabase: SupabaseLike, offset: number, limit: number) {
  const { data, error } = await supabase
    .from('events')
    .select(`
      id, creator_id, title, description, starts_at, ends_at, venue_name, is_online, cover_image_url, category, created_at,
      creator:profiles!creator_id(id, full_name, avatar_url, trust_balance)
    `)
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[feed/posts events]', error.message)
    return NextResponse.json({ posts: [], hasMore: false })
  }

  const items: FeedItem[] = (data ?? []).map((e: Record<string, unknown>) => ({
    id: `event-${e.id}`,
    user_id: e.creator_id as string,
    type: 'event',
    content: (e.description as string) ?? null,
    media_url: (e.cover_image_url as string) ?? null,
    media_type: e.cover_image_url ? 'image' : null,
    title: e.title as string,
    link_url: `/events/${e.id}`,
    likes_count: 0,
    comments_count: 0,
    saves_count: 0,
    views_count: 0,
    created_at: (e.starts_at as string) ?? (e.created_at as string),
    profiles: Array.isArray(e.creator) ? (e.creator[0] ?? null) : ((e.creator as FeedItem['profiles']) ?? null),
  }))

  return NextResponse.json({ posts: items, hasMore: items.length === limit })
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
