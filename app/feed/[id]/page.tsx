import { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostPageClient from './PostPageClient'

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
      id, type, content, title, media_url, created_at,
      profiles!feed_posts_user_id_fkey(full_name, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!post) {
    return { title: 'Post not found — FreeTrust' }
  }

  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
  const authorName = (profile as { full_name?: string | null } | null)?.full_name ?? 'FreeTrust member'
  const title  = (post.title ?? post.content?.slice(0, 80) ?? 'A post on FreeTrust')
  const description = post.content?.slice(0, 200) ?? `${authorName} shared something on FreeTrust`
  const mediaUrl = post.media_url as string | null
  const postUrl  = `https://freetrust.vercel.app/feed/${id}`

  const images = mediaUrl ? [{ url: mediaUrl, width: 1200, height: 630, alt: title }] : []

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
      card: mediaUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: mediaUrl ? [mediaUrl] : [],
      site: '@FreeTrust',
    },
    metadataBase: new URL('https://freetrust.vercel.app'),
    alternates: { canonical: postUrl },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PostPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('feed_posts')
    .select(`
      id, user_id, type, content, title, media_url, media_type, link_url,
      likes_count, comments_count, saves_count, views_count, created_at,
      profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, username, trust_balance)
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
      id, user_id, type, content, title, media_url, media_type,
      likes_count, comments_count, saves_count, created_at,
      profiles!feed_posts_user_id_fkey(id, full_name, avatar_url, username, trust_balance)
    `)
    .eq('user_id', authorId)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(3)

  // Normalise profiles array → single object
  const normalisePost = (p: Record<string, unknown>) => {
    const prof = p.profiles
    return {
      ...p,
      profiles: Array.isArray(prof) ? prof[0] ?? null : prof ?? null,
    }
  }

  return (
    <PostPageClient
      post={normalisePost(post as Record<string, unknown>) as Parameters<typeof PostPageClient>[0]['post']}
      related={(related ?? []).map(r => normalisePost(r as Record<string, unknown>)) as Parameters<typeof PostPageClient>[0]['related']}
    />
  )
}
