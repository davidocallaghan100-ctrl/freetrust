'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'
import PostCard, { FeedPost } from '@/components/PostCard'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedScope = 'discover' | 'following'
type Filter = 'all' | 'photos' | 'videos' | 'articles' | 'services' | 'jobs' | 'events' | 'trending'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'photos',   label: 'Photos'   },
  { key: 'videos',   label: 'Videos'   },
  { key: 'articles', label: 'Articles' },
  { key: 'services', label: 'Services' },
  { key: 'jobs',     label: 'Jobs'     },
  { key: 'events',   label: 'Events'   },
  { key: 'trending', label: 'Trending' },
]

const TRENDING_TAGS = ['#TrustEconomy', '#FreelanceLife', '#ImpactInvesting', '#BuildInPublic', '#SustainableBusiness', '#CreatorEconomy']

const EMPTY_META: Record<Filter, { icon: string; title: string; sub: string }> = {
  all:      { icon: '🌱', title: 'No posts yet',         sub: 'Be the first to share something!' },
  photos:   { icon: '📷', title: 'No photos yet',        sub: 'Share a photo to get this filter going.' },
  videos:   { icon: '🎬', title: 'No videos yet',        sub: 'Upload a video to be the first.' },
  articles: { icon: '📰', title: 'No articles yet',      sub: 'Publish an article to get featured here.' },
  services: { icon: '🛠',  title: 'No services yet',      sub: 'List a service to get discovered.' },
  jobs:     { icon: '💼', title: 'No active jobs',       sub: 'Post a job to find collaborators.' },
  events:   { icon: '📅', title: 'No upcoming events',   sub: 'Create an event to bring people together.' },
  trending: { icon: '🔥', title: 'Nothing trending yet', sub: 'Posts from the last 24 hours will appear here once they get likes and comments.' },
}

// ── Composer ──────────────────────────────────────────────────────────────────
// Note: the previous version of this card had a row of quick-action icons
// (Photo / Video / Article / Job / Event / Listing) that navigated to
// /create?type=X. Those labels were almost identical to the filter pills
// rendered just below the composer, so users were clicking them expecting
// to filter the feed and getting navigated to the create page instead.
// We removed the icon row — the "What's on your mind?" button still goes
// to /create where the type picker lives.

function ComposerCard() {
  const router   = useRouter()
  const supabase = createClient()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userName,  setUserName]  = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', session.user.id).maybeSingle()
          setAvatarUrl(data?.avatar_url ?? null)
          setUserName(data?.full_name ?? null)
        }
      } catch { /* silent */ }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Avatar url={avatarUrl} name={userName} size={40} />
        <button
          onClick={() => router.push('/create')}
          style={{ flex: 1, textAlign: 'left', background: '#0f172a', border: '1px solid #334155', borderRadius: '999px', padding: '0.65rem 1.1rem', fontSize: '0.9rem', color: '#475569', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
        >
          What&apos;s on your mind?
        </button>
        <button
          onClick={() => router.push('/create')}
          style={{ flexShrink: 0, background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          title="Create a new post"
        >
          + Post
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// Read initial filter from URL once on mount. Server-rendered first paint
// always sees `all` to avoid hydration mismatches; the effect below restores
// the URL filter on the client.
const VALID_FILTERS: Filter[] = ['all', 'photos', 'videos', 'articles', 'services', 'jobs', 'events', 'trending']

export default function FeedPage() {
  const [posts,         setPosts]         = useState<FeedPost[]>([])
  const [page,          setPage]          = useState(1)
  const [hasMore,       setHasMore]       = useState(true)
  const [loading,       setLoading]       = useState(true)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const [scope,         setScope]         = useState<FeedScope>('discover')
  const [activeFilter,  setActiveFilter]  = useState<Filter>('all')
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)
  const [newPostsAvailable, setNewPostsAvailable] = useState(0)
  const newestSeenAtRef = useRef<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // ── URL <-> filter sync ──
  // On mount, restore filter from ?filter=X. After mount, every filter
  // change writes back to the URL via replaceState (no navigation).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('filter') as Filter | null
    if (fromUrl && VALID_FILTERS.includes(fromUrl)) {
      setActiveFilter(fromUrl)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (activeFilter === 'all') {
      params.delete('filter')
    } else {
      params.set('filter', activeFilter)
    }
    const qs = params.toString()
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }, [activeFilter])

  // Server param: when scope=following, override the filter param
  const apiFilter = scope === 'following' && activeFilter === 'all' ? 'following' : activeFilter

  const fetchPosts = useCallback(async (pageNum: number, append = false) => {
    try {
      const res  = await fetch(`/api/feed/posts?page=${pageNum}&filter=${apiFilter}`)
      const data = await res.json()
      const newPosts: FeedPost[] = (data.posts ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : (p.profiles ?? null),
      }))
      setPosts(prev => append ? [...prev, ...newPosts] : newPosts)
      setHasMore(data.hasMore ?? false)
      // Track the newest created_at we've seen so realtime can compare
      if (!append && newPosts.length > 0) {
        newestSeenAtRef.current = newPosts[0].created_at
        setNewPostsAvailable(0)
      }
    } catch { /* silent */ }
    finally { setLoading(false); setLoadingMore(false) }
  }, [apiFilter])

  // Load current user ID once on mount for delete ownership check
  useEffect(() => {
    const cached = sessionStorage.getItem('ft_uid')
    if (cached) setCurrentUserId(cached)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
        sessionStorage.setItem('ft_uid', data.user.id)
      }
    }).catch(() => {})
  }, [])

  // Re-fetch when scope or filter changes
  useEffect(() => {
    setLoading(true); setPage(1)
    fetchPosts(1, false)
  }, [scope, activeFilter, fetchPosts])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return
    setLoadingMore(true)
    const next = page + 1
    setPage(next)
    await fetchPosts(next, true)
  }, [loadingMore, loading, hasMore, page, fetchPosts])

  // ── Infinite scroll via IntersectionObserver ──
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '600px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore])

  // ── Realtime: notify when new posts are inserted ──
  // Only fires for the Discover/All view (not when filtered to a side table).
  useEffect(() => {
    if (activeFilter !== 'all') return
    const supabase = createClient()
    const channel = supabase
      .channel('feed_posts_inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_posts' },
        (payload) => {
          const newCreated = (payload.new as { created_at?: string; user_id?: string })?.created_at
          const newUserId  = (payload.new as { user_id?: string })?.user_id
          if (!newCreated) return
          // Don't toast the user about their own post
          if (newUserId && newUserId === currentUserId) return
          if (!newestSeenAtRef.current || newCreated > newestSeenAtRef.current) {
            setNewPostsAvailable(c => c + 1)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeFilter, currentUserId])

  const refreshFromTop = useCallback(async () => {
    setNewPostsAvailable(0)
    setLoading(true)
    setPage(1)
    await fetchPosts(1, false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [fetchPosts])

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .feed-grid { display: grid; grid-template-columns: 1fr 272px; gap: 1.5rem; max-width: 1080px; margin: 0 auto; padding: 1.5rem; align-items: start; }
        .feed-main-col { min-width: 0; width: 100%; overflow: hidden; }
        .feed-sidebar-col { position: sticky; top: 110px; display: flex; flex-direction: column; gap: 1rem; }
        @media (max-width: 800px) {
          .feed-grid { grid-template-columns: 1fr !important; padding: 0.75rem !important; gap: 0; }
          .feed-sidebar-col { display: none !important; }
        }
        .feed-filter-pills { display: flex; gap: 0.4rem; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; margin-bottom: 1rem; scrollbar-width: none; }
        .feed-filter-pills::-webkit-scrollbar { display: none; }
        .feed-filter-pills button { flex-shrink: 0; }
      `}</style>

      {/* New posts toast */}
      {newPostsAvailable > 0 && (
        <button
          onClick={refreshFromTop}
          style={{
            position: 'fixed', top: 78, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
            background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 999,
            padding: '0.55rem 1.2rem', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(56,189,248,0.4)', fontFamily: 'inherit',
          }}
        >
          ↑ {newPostsAvailable === 1 ? '1 new post' : `${newPostsAvailable} new posts`}
        </button>
      )}

      <div className="feed-grid">
        <main className="feed-main-col">
          <ComposerCard />

          {/* Discover / Following toggle */}
          <div style={{ display: 'flex', gap: 4, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 4, marginBottom: '0.85rem' }}>
            {(['discover', 'following'] as const).map(s => {
              const active = scope === s
              return (
                <button
                  key={s}
                  onClick={() => { setScope(s); setActiveFilter('all') }}
                  style={{
                    flex: 1, padding: '0.55rem 1rem', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: active ? 700 : 500,
                    background: active ? '#0f172a' : 'transparent',
                    color: active ? '#38bdf8' : '#64748b',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {s === 'discover' ? '✨ Discover' : '👥 Following'}
                </button>
              )
            })}
          </div>

          {/* Filter pills */}
          <div className="feed-filter-pills">
            {FILTERS.map(({ key, label }) => {
              const isActive = activeFilter === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  style={{ padding: '0.28rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: isActive ? '#38bdf8' : 'transparent', color: isActive ? '#0f172a' : '#64748b', border: `1px solid ${isActive ? '#38bdf8' : '#334155'}`, transition: 'all 0.15s', fontFamily: 'inherit' }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {loading ? (
            // Skeleton cards
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#334155' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '40%', height: 12, background: '#334155', borderRadius: 6, marginBottom: 6 }} />
                    <div style={{ width: '25%', height: 10, background: '#334155', borderRadius: 6 }} />
                  </div>
                </div>
                <div style={{ height: 14, background: '#334155', borderRadius: 6, marginBottom: 8 }} />
                <div style={{ height: 14, background: '#334155', borderRadius: 6, width: '85%', marginBottom: 8 }} />
                <div style={{ height: 14, background: '#334155', borderRadius: 6, width: '60%' }} />
              </div>
            ))
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b', background: '#1e293b', border: '1px solid #334155', borderRadius: 14 }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {scope === 'following' && activeFilter === 'all' ? '👥' : EMPTY_META[activeFilter].icon}
              </div>
              <h3 style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>
                {scope === 'following' && activeFilter === 'all'
                  ? 'No posts from people you follow yet'
                  : EMPTY_META[activeFilter].title}
              </h3>
              <p style={{ marginBottom: '1.5rem' }}>
                {scope === 'following' && activeFilter === 'all'
                  ? 'Find collaborators to follow on the People page, then their posts will appear here.'
                  : EMPTY_META[activeFilter].sub}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {scope === 'following' && activeFilter === 'all' ? (
                  <>
                    <Link href="/collab/people" style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>Find people</Link>
                    <button onClick={() => setScope('discover')} style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>Browse Discover</button>
                  </>
                ) : (
                  <Link href="/create" style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>Create a post</Link>
                )}
              </div>
            </div>
          ) : (
            <>
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
                />
              ))}
              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {loadingMore && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>Loading more…</div>
              )}
              {!hasMore && posts.length > 0 && (
                <div style={{ textAlign: 'center', padding: '1.25rem', color: '#475569', fontSize: '0.82rem' }}>You&rsquo;re all caught up ✨</div>
              )}
            </>
          )}
        </main>

        <aside className="feed-sidebar-col">
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' }}>Trending Topics</div>
            {TRENDING_TAGS.map(tag => (
              <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} style={{ display: 'block', padding: '0.4rem 0', fontSize: '0.83rem', color: '#38bdf8', textDecoration: 'none', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>{tag}</Link>
            ))}
          </div>
          <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>✨ Discover</div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>The Discover feed ranks posts by recency, engagement and the trust score of the author — so the best content rises to the top.</p>
            <button onClick={() => { setScope('discover'); setActiveFilter('all') }} style={{ display: 'block', width: '100%', padding: '0.5rem', borderRadius: 7, border: '1px solid rgba(56,189,248,0.2)', background: 'transparent', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Open Discover</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
