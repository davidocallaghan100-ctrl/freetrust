import { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostPageClient from './PostPageClient'

type ReactionCounts = { trust: number; love: number; insightful: number; collab: number; total: number }

function normaliseProfileJoin(profile: unknown) {
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null
}

async function hydrateFeedPosts(supabase: Awaited<ReturnType<typeof createClient>>, posts: Record<string, unknown>[], currentUserId: string | null) {
  if (posts.length === 0) return []

  const postIds = posts
    .map(post => typeof post.id === 'string' ? post.id : null)
    .filter((id): id is string => Boolean(id))

  const commentCountMap: Record<string, number> = {}
  const likeCountMap: Record<string, number> = {}
  const saveCountMap: Record<string, number> = {}
  const reactionCountsMap: Record<string, ReactionCounts> = {}
  const userReactionMap: Record<string, string> = {}
  const topCommentMap: Record<string, { id: string; content: string; author_name: string | null } | null> = {}

  const [
    allLikesRes,
    allSavesRes,
    commentsRes,
    allReactionsRes,
    userLikesRes,
    userSavesRes,
    userReactionsRes,
    topCommentsRes,
  ] = await Promise.all([
    supabase.from('feed_likes').select('post_id').in('post_id', postIds),
    supabase.from('feed_saves').select('post_id').in('post_id', postIds),
    supabase.from('feed_comments').select('post_id').in('post_id', postIds),
    supabase.from('feed_reactions').select('post_id, reaction_type').in('post_id', postIds),
    currentUserId ? supabase.from('feed_likes').select('post_id').eq('user_id', currentUserId).in('post_id', postIds) : Promise.resolve({ data: [] }),
    currentUserId ? supabase.from('feed_saves').select('post_id').eq('user_id', currentUserId).in('post_id', postIds) : Promise.resolve({ data: [] }),
    currentUserId ? supabase.from('feed_reactions').select('post_id, reaction_type').eq('user_id', currentUserId).in('post_id', postIds) : Promise.resolve({ data: [] }),
    supabase
      .from('feed_comments')
      .select('id, post_id, content, created_at, profiles:user_id(full_name)')
      .in('post_id', postIds)
      .order('created_at', { ascending: false }),
  ])

  ;((allLikesRes.data ?? []) as { post_id: string }[]).forEach(like => {
    likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1
  })

  ;((allSavesRes.data ?? []) as { post_id: string }[]).forEach(save => {
    saveCountMap[save.post_id] = (saveCountMap[save.post_id] ?? 0) + 1
  })

  ;((commentsRes.data ?? []) as { post_id: string }[]).forEach(comment => {
    commentCountMap[comment.post_id] = (commentCountMap[comment.post_id] ?? 0) + 1
  })

  if (!allReactionsRes.error) {
    ;((allReactionsRes.data ?? []) as { post_id: string; reaction_type: string }[]).forEach(reaction => {
      if (!reactionCountsMap[reaction.post_id]) {
        reactionCountsMap[reaction.post_id] = { trust: 0, love: 0, insightful: 0, collab: 0, total: 0 }
      }
      const counts = reactionCountsMap[reaction.post_id]
      if (reaction.reaction_type in counts) {
        ;(counts as Record<string, number>)[reaction.reaction_type]++
        counts.total++
      }
    })
  }

  ;(((userReactionsRes as { data?: { post_id: string; reaction_type: string }[] }).data ?? [])).forEach(reaction => {
    userReactionMap[reaction.post_id] = reaction.reaction_type
  })

  const seenTopComments = new Set<string>()
  ;((topCommentsRes.data ?? []) as Array<{ id: string; post_id: string; content: string; profiles: { full_name: string | null } | { full_name: string | null }[] | null }>).forEach(comment => {
    if (seenTopComments.has(comment.post_id)) return
    seenTopComments.add(comment.post_id)
    const profile = normaliseProfileJoin(comment.profiles) as { full_name?: string | null } | null
    topCommentMap[comment.post_id] = {
      id: comment.id,
      content: comment.content,
      author_name: profile?.full_name ?? null,
    }
  })

  const likedIds = new Set(((userLikesRes as { data?: { post_id: string }[] }).data ?? []).map(row => row.post_id))
  const savedIds = new Set(((userSavesRes as { data?: { post_id: string }[] }).data ?? []).map(row => row.post_id))

  return posts.map(post => {
    const id = post.id as string
    return {
      ...post,
      profiles: normaliseProfileJoin(post.profiles),
      posted_as_organisation: normaliseProfileJoin(post.posted_as_organisation),
      likes_count: likeCountMap[id] ?? 0,
      comments_count: commentCountMap[id] ?? 0,
      saves_count: saveCountMap[id] ?? 0,
      liked: likedIds.has(id),
      saved: savedIds.has(id),
      reactions: reactionCountsMap[id] ?? { trust: 0, love: 0, insightful: 0, collab: 0, total: 0 },
      user_reaction: userReactionMap[id] ?? null,
      top_comment: topCommentMap[id] ?? null,
    }
  })
}

// Canonical site URL. Previously hardcoded to freetrust.vercel.app
// which made every shared feed post link preview point at the preview
// subdomain instead of the launch domain — broke OG image previews
// and the canonical URL for search engines.
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
const FALLBACK_OG_IMAGE = `${BASE}/icons/icon-512x512.png`

function stripInternalMarkers(text: string | null | undefined) {
  return text
    ?.replace(/\n?\n?\[\[FT_MEDIA_URLS:[A-Za-z0-9_-]+\]\]/g, '')
    .replace(/\n?\n?\[\[FT_SPOTIFY:[A-Za-z0-9_-]+\]\]/g, '')
    .trim() ?? ''
}

function isImagePost(type: unknown, mediaType: unknown, mediaUrl: unknown) {
  return typeof mediaUrl === 'string'
    && /^https?:\/\//i.test(mediaUrl)
    && (type === 'photo' || (typeof mediaType === 'string' && mediaType.startsWith('image/')))
}

// ── OG meta ───────────────────────────────────────────────────────────────────

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('feed_posts')
    .select(`
      id, type, content, title, media_url, media_type, music_background_url, music_waveform, created_at,
      profiles!feed_posts_user_id_fkey(full_name, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!post) {
    return { title: 'Post not found — FreeTrust' }
  }

  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
  const authorName = (profile as { full_name?: string | null } | null)?.full_name ?? 'FreeTrust member'
  const cleanContent = stripInternalMarkers(post.content)
  const title  = post.title || cleanContent.slice(0, 80) || 'A post on FreeTrust'
  const description = cleanContent.slice(0, 200) || `${authorName} shared something on FreeTrust`
  const mediaUrl = isImagePost(post.type, post.media_type, post.media_url) ? post.media_url as string : null
  const postUrl  = `${BASE}/feed/${id}`
  const backgroundUrl = typeof post.music_background_url === 'string' && /^https?:\/\//i.test(post.music_background_url)
    ? post.music_background_url
    : null
  const ogImageUrl = mediaUrl ?? backgroundUrl ?? FALLBACK_OG_IMAGE

  const images = [{ url: ogImageUrl, width: 1200, height: 630, alt: title }]

  return {
    title: `${title} — FreeTrust`,
    description,
    openGraph: {
      title,
      description,
      url: postUrl,
      siteName: 'FreeTrust',
      type: 'article',
      images,
      authors: [authorName],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
      site: '@FreeTrust',
    },
    metadataBase: new URL(BASE),
    alternates: { canonical: postUrl },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PostPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: post } = await supabase
    .from('feed_posts')
    .select(`
      id, user_id, type, content, title, media_url, media_type, music_background_url, music_waveform, link_url,
      likes_count, comments_count, saves_count, views_count, created_at, updated_at,
      posted_as_organisation_id,
      profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, username, trust_balance, is_verified, verified_at, verification_status),
      posted_as_organisation:organisations!posted_as_organisation_id(id, name, slug, logo_url)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!post) notFound()

  // Increment view count (best effort)
  try { await supabase.rpc('increment_post_views', { post_id: id }) } catch { /* silent */ }

  // Fetch recent related posts (same author)
  const authorId = post.user_id as string
  const { data: related } = await supabase
    .from('feed_posts')
    .select(`
       id, user_id, type, content, title, media_url, media_type, music_background_url, music_waveform,
      link_url, likes_count, comments_count, saves_count, views_count, created_at, updated_at,
      posted_as_organisation_id,
      profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, username, trust_balance, is_verified, verified_at, verification_status),
      posted_as_organisation:organisations!posted_as_organisation_id(id, name, slug, logo_url)
    `)
    .eq('user_id', authorId)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(3)

  const hydratedPosts = await hydrateFeedPosts(
    supabase,
    [post as Record<string, unknown>, ...((related ?? []) as Record<string, unknown>[])],
    user?.id ?? null
  )
  const [hydratedPost, ...hydratedRelated] = hydratedPosts

  return (
    <PostPageClient
      post={hydratedPost as Parameters<typeof PostPageClient>[0]['post']}
      related={hydratedRelated as Parameters<typeof PostPageClient>[0]['related']}
      currentUserId={user?.id ?? null}
    />
  )
}
