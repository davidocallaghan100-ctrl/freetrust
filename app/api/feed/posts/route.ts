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
  // Display override for "post as organisation" — when set, PostCard
  // renders the org's logo / name / slug in place of the author's
  // profile block. Null for normal personal posts. The `posted_as_
  // organisation_id` scalar stays alongside for the rare client that
  // wants to handle the override manually.
  posted_as_organisation_id?: string | null
  posted_as_organisation?: {
    id: string
    name: string
    slug: string | null
    logo_url: string | null
  } | null
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

    // ── feed_posts query (all/discover / photos / videos / trending / following) ─────
    // For 'discover' (default) we fetch a wider candidate set, then re-rank in
    // memory using a smart score combining recency + engagement + author trust.
    const isDiscover = filter === 'all' || filter === 'discover'
    const candidateMultiplier = isDiscover ? 3 : 1
    const fetchLimit = limit * candidateMultiplier

    // NOTE: keep this select list as a single template literal. Supabase's
    // typed client infers the row type from the literal argument; splitting
    // with + concatenation collapses it to `string` and the result type
    // degrades to GenericStringError, breaking every downstream access.
    // See commit 5a71dce for the bug history.
    let query = supabase
      .from('feed_posts')
      .select(`
        id, user_id, type, content, media_url, media_type, title, link_url,
        trust_reward, likes_count, comments_count, saves_count, views_count, created_at,
        posted_as_organisation_id,
        profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, trust_balance),
        posted_as_organisation:organisations!posted_as_organisation_id(id, name, slug, logo_url)
      `)

    if (filter === 'photos') {
      query = query.or('type.eq.photo,media_type.eq.image')
    } else if (filter === 'videos') {
      query = query.or('type.eq.video,type.eq.short,media_type.eq.video')
    } else if (filter === 'trending') {
      // Posts from the last 24h, ordered by engagement (likes + comments)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      query = query
        .gte('created_at', since)
        .order('likes_count', { ascending: false })
        .order('comments_count', { ascending: false })
    } else if (filter === 'following' && user) {
      // Posts from users the current user follows (newest first)
      const { data: following } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const ids = (following ?? []).map((f: { following_id: string }) => f.following_id)
      if (ids.length > 0) {
        query = query.in('user_id', ids)
      } else {
        return NextResponse.json({ posts: [], hasMore: false, message: 'no_following' })
      }
    } else if (legacyType && legacyType !== 'all') {
      query = query.eq('type', legacyType)
    }
    // 'all'/'discover' falls through — re-ranked below

    if (filter !== 'trending') {
      query = query.order('created_at', { ascending: false })
    }

    if (isDiscover) {
      // Fetch a wider candidate window for re-ranking. Pagination still uses
      // offset/limit but we widen each page's candidate pool by the multiplier.
      query = query.range(offset * candidateMultiplier, offset * candidateMultiplier + fetchLimit - 1)
    } else {
      query = query.range(offset, offset + limit - 1)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('[feed/posts GET]', error)
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    let likedIds: string[] = []
    let savedIds: string[] = []
    const commentCountMap: Record<string, number> = {}
    const likeCountMap: Record<string, number> = {}
    const saveCountMap: Record<string, number> = {}
    const reactionCountsMap: Record<string, { trust: number; love: number; insightful: number; collab: number; total: number }> = {}
    const userReactionMap: Record<string, string> = {}
    const topCommentMap: Record<string, { id: string; content: string; author_name: string | null } | null> = {}
    let followingSet: Set<string> = new Set()

    if (posts && posts.length > 0) {
      const postIds = posts.map((p: { id: string }) => p.id)

      // Real engagement counts come from the junction tables, not the cached
      // columns on feed_posts. Run everything in parallel.
      const [
        allLikesRes,
        allSavesRes,
        commentsRes,
        userLikesRes,
        userSavesRes,
        allReactionsRes,
        userReactionsRes,
        topCommentsRes,
        followingRes,
      ] = await Promise.all([
        supabase.from('feed_likes').select('post_id').in('post_id', postIds),
        supabase.from('feed_saves').select('post_id').in('post_id', postIds),
        supabase.from('feed_comments').select('post_id').in('post_id', postIds),
        user ? supabase.from('feed_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] }),
        user ? supabase.from('feed_saves').select('post_id').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] }),
        // Reactions are optional — table may not exist yet. .catch handled below.
        supabase.from('feed_reactions').select('post_id, reaction_type').in('post_id', postIds),
        user ? supabase.from('feed_reactions').select('post_id, reaction_type').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] }),
        // Top comment per post (most recent for now). Limited to 1 per post via
        // a single query that's grouped client-side.
        supabase
          .from('feed_comments')
          .select('id, post_id, content, created_at, profiles:user_id(full_name)')
          .in('post_id', postIds)
          .order('created_at', { ascending: false }),
        user
          ? supabase.from('user_follows').select('following_id').eq('follower_id', user.id)
          : Promise.resolve({ data: [] }),
      ])

      // Per-post counts
      ;((allLikesRes.data ?? []) as { post_id: string }[]).forEach((l) => {
        likeCountMap[l.post_id] = (likeCountMap[l.post_id] ?? 0) + 1
      })
      ;((allSavesRes.data ?? []) as { post_id: string }[]).forEach((s) => {
        saveCountMap[s.post_id] = (saveCountMap[s.post_id] ?? 0) + 1
      })
      ;((commentsRes.data ?? []) as { post_id: string }[]).forEach((c) => {
        commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1
      })

      // Reactions per post (per-type counts). Silently ignore if table missing.
      if (!allReactionsRes.error) {
        ;((allReactionsRes.data ?? []) as { post_id: string; reaction_type: string }[]).forEach((r) => {
          if (!reactionCountsMap[r.post_id]) {
            reactionCountsMap[r.post_id] = { trust: 0, love: 0, insightful: 0, collab: 0, total: 0 }
          }
          const m = reactionCountsMap[r.post_id]
          if (r.reaction_type in m) {
            (m as Record<string, number>)[r.reaction_type]++
            m.total++
          }
        })
      }

      if (userReactionsRes && !('error' in userReactionsRes && userReactionsRes.error)) {
        ;((userReactionsRes.data ?? []) as { post_id: string; reaction_type: string }[]).forEach((r) => {
          userReactionMap[r.post_id] = r.reaction_type
        })
      }

      // Top comment per post — first comment encountered per post id (newest
      // first because the query was ordered DESC).
      const seen = new Set<string>()
      ;((topCommentsRes.data ?? []) as Array<{ id: string; post_id: string; content: string; profiles: { full_name: string | null } | { full_name: string | null }[] | null }>).forEach((c) => {
        if (seen.has(c.post_id)) return
        seen.add(c.post_id)
        const author = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
        topCommentMap[c.post_id] = {
          id: c.id,
          content: c.content,
          author_name: author?.full_name ?? null,
        }
      })

      // Per-user flags
      likedIds = ((userLikesRes as { data: { post_id: string }[] | null }).data ?? []).map((l) => l.post_id)
      savedIds = ((userSavesRes as { data: { post_id: string }[] | null }).data ?? []).map((s) => s.post_id)

      // Followed users (boost their posts in Discover ranking)
      followingSet = new Set(((followingRes.data ?? []) as { following_id: string }[]).map(f => f.following_id))
    }

    let enriched: Record<string, unknown>[] = (posts ?? []).map((p: Record<string, unknown>) => {
      const realLikes = likeCountMap[p.id as string] ?? 0
      const realComments = commentCountMap[p.id as string] ?? 0
      const reactions = reactionCountsMap[p.id as string] ?? { trust: 0, love: 0, insightful: 0, collab: 0, total: 0 }
      // Normalise the posted_as_organisation join — Supabase returns
      // either a single row or a one-element array depending on the
      // relationship direction. PostCard expects a plain object or null.
      const orgRaw = p.posted_as_organisation
      const postedAsOrg = Array.isArray(orgRaw) ? (orgRaw[0] ?? null) : (orgRaw ?? null)
      return {
        ...p,
        likes_count: realLikes,
        saves_count: saveCountMap[p.id as string] ?? 0,
        comments_count: realComments,
        views_count: Number((p as { views_count?: number }).views_count ?? 0),
        reactions,
        user_reaction: userReactionMap[p.id as string] ?? null,
        top_comment: topCommentMap[p.id as string] ?? null,
        liked: likedIds.includes(p.id as string),
        saved: savedIds.includes(p.id as string),
        posted_as_organisation: postedAsOrg,
      }
    })

    // ── Smart Discover ranking ───────────────────────────────────────────────
    // Score = engagementWeight * (likes + 2*comments + reactions)
    //       + recencyWeight * 1/(1 + ageHours)
    //       + trustWeight * sqrt(authorTrust)
    //       + followBoost (if author is followed by viewer)
    if (isDiscover) {
      const now = Date.now()
      const W_ENGAGEMENT = 1.0
      const W_RECENCY    = 80.0
      const W_TRUST      = 0.4
      const FOLLOW_BOOST = 25.0

      enriched = enriched
        .map((p: Record<string, unknown>) => {
          const created = new Date(p.created_at as string).getTime()
          const ageHours = Math.max(0.5, (now - created) / 3_600_000)
          const recencyScore = 1 / (1 + ageHours / 6) // half-life ~6h
          const likes = (p.likes_count as number) ?? 0
          const comments = (p.comments_count as number) ?? 0
          const reactionsTotal = ((p.reactions as { total?: number })?.total) ?? 0
          const engagement = likes + 2 * comments + reactionsTotal
          const profile = p.profiles as { trust_balance?: number } | { trust_balance?: number }[] | null
          const author = Array.isArray(profile) ? profile[0] : profile
          const trustScore = Math.sqrt(Math.max(0, author?.trust_balance ?? 0))
          const isFollowed = user && followingSet.has(p.user_id as string)
          const score =
            W_ENGAGEMENT * engagement +
            W_RECENCY    * recencyScore +
            W_TRUST      * trustScore +
            (isFollowed ? FOLLOW_BOOST : 0)
          return { ...p, _score: score }
        })
        .sort((a, b) => (b._score as number) - (a._score as number))
        .slice(0, limit)
        .map((p: Record<string, unknown>) => {
          // Strip internal score before sending to client
          const { _score, ...rest } = p as Record<string, unknown> & { _score?: number }
          void _score
          return rest
        })
    }

    return NextResponse.json({
      posts: enriched,
      hasMore: enriched.length === limit,
    })
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
      created_at, published_at,
      posted_as_organisation_id,
      author:profiles!author_id(id, full_name, avatar_url, trust_balance),
      posted_as_organisation:organisations!posted_as_organisation_id(id, name, slug, logo_url)
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[feed/posts articles]', error.message)
    return NextResponse.json({ posts: [], hasMore: false })
  }

  // Don't trust the cached articles.comment_count / clap_count columns —
  // they may have drifted from seeded data or buggy increment logic.
  // Count real rows in article_comments and article_claps for the visible
  // article ids in two parallel round-trips.
  const articleIds = (data ?? []).map((a: Record<string, unknown>) => a.id as string)
  const realCommentCounts: Record<string, number> = {}
  const realClapCounts: Record<string, number> = {}
  if (articleIds.length > 0) {
    const [commentsRes, clapsRes] = await Promise.all([
      supabase.from('article_comments').select('article_id').in('article_id', articleIds),
      supabase.from('article_claps').select('article_id').in('article_id', articleIds),
    ])
    for (const row of commentsRes.data ?? []) {
      const aid = (row as { article_id: string }).article_id
      realCommentCounts[aid] = (realCommentCounts[aid] ?? 0) + 1
    }
    for (const row of clapsRes.data ?? []) {
      const aid = (row as { article_id: string }).article_id
      realClapCounts[aid] = (realClapCounts[aid] ?? 0) + 1
    }
  }

  const items: FeedItem[] = (data ?? []).map((a: Record<string, unknown>) => {
    // Supabase returns foreign-key joins as EITHER a single row OR a
    // one-element array depending on the relationship direction. We
    // normalise both shapes so PostCard sees a plain object or null.
    const orgRaw = a.posted_as_organisation
    const postedAsOrg = Array.isArray(orgRaw)
      ? (orgRaw[0] ?? null)
      : (orgRaw as FeedItem['posted_as_organisation']) ?? null
    return {
      id: `article-${a.id}`,
      user_id: a.author_id as string,
      type: 'article',
      content: (a.excerpt as string) ?? null,
      media_url: (a.featured_image_url as string) ?? null,
      media_type: a.featured_image_url ? 'image' : null,
      title: a.title as string,
      link_url: `/articles/${a.slug}`,
      likes_count: realClapCounts[a.id as string] ?? 0,
      comments_count: realCommentCounts[a.id as string] ?? 0,
      saves_count: 0,
      views_count: 0,
      created_at: (a.published_at as string) ?? (a.created_at as string),
      profiles: Array.isArray(a.author) ? (a.author[0] ?? null) : ((a.author as FeedItem['profiles']) ?? null),
      posted_as_organisation_id: (a.posted_as_organisation_id as string | null) ?? null,
      posted_as_organisation: postedAsOrg,
    }
  })

  return NextResponse.json({ posts: items, hasMore: items.length === limit })
}

async function fetchServices(supabase: SupabaseLike, offset: number, limit: number) {
  // Services live in the `listings` table with product_type='service'.
  // Same canonical pattern as app/services/page.tsx and
  // app/api/admin/content/route.ts. There is no separate `services` table.
  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, seller_id, title, description, category, price, currency, cover_image, created_at,
      seller:profiles!seller_id(id, full_name, avatar_url, trust_balance)
    `)
    .eq('product_type', 'service')
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
