'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'
import PostCard, { FeedPost } from '@/components/PostCard'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'videos' | 'articles' | 'services' | 'jobs' | 'events' | 'trending'

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPOSER_ACTIONS = [
  { icon: '📷', label: 'Photo',   type: 'photo'   },
  { icon: '🎥', label: 'Video',   type: 'video'   },
  { icon: '🔗', label: 'Link',    type: 'link'    },
  { icon: '📝', label: 'Article', type: 'article' },
  { icon: '💼', label: 'Job',     type: 'job'     },
  { icon: '📅', label: 'Event',   type: 'event'   },
  { icon: '🛍',  label: 'Listing', type: 'service' },
]

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'videos',   label: 'Videos'   },
  { key: 'articles', label: 'Articles' },
  { key: 'services', label: 'Services' },
  { key: 'jobs',     label: 'Jobs'     },
  { key: 'events',   label: 'Events'   },
  { key: 'trending', label: 'Trending' },
]

const TRENDING_TAGS = ['#TrustEconomy', '#FreelanceLife', '#ImpactInvesting', '#BuildInPublic', '#SustainableBusiness', '#CreatorEconomy']

// ── Composer ──────────────────────────────────────────────────────────────────

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

  const goCreate = (type?: string) => router.push(type ? `/create?type=${type}` : '/create')

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '0.85rem' }}>
      {/* Avatar + fake text input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Avatar url={avatarUrl} name={userName} size={40} />
        <button
          onClick={() => goCreate()}
          style={{ flex: 1, textAlign: 'left', background: '#0f172a', border: '1px solid #334155', borderRadius: '999px', padding: '0.65rem 1.1rem', fontSize: '0.9rem', color: '#475569', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
        >
          What&apos;s on your mind?
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#334155', margin: '0.85rem 0 0.65rem' }} />

      {/* Quick-action icon row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        {COMPOSER_ACTIONS.map(({ icon, label, type }) => (
          <button
            key={type}
            onClick={() => goCreate(type)}
            title={label}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.5rem', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', fontWeight: 500, transition: 'color 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#38bdf8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
          >
            <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{icon}</span>
            <span className="composer-label" style={{ display: 'none' }}>{label}</span>
          </button>
        ))}
      </div>

      <style>{`@media (min-width: 520px) { .composer-label { display: inline !important; } }`}</style>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [posts,        setPosts]        = useState<FeedPost[]>([])
  const [page,         setPage]         = useState(1)
  const [hasMore,      setHasMore]      = useState(true)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [activeFilter, setActiveFilter] = useState<Filter>('all')

  const fetchPosts = useCallback(async (pageNum: number, append = false, filter: Filter = 'all') => {
    try {
      const res  = await fetch(`/api/feed/posts?page=${pageNum}&filter=${filter}`)
      const data = await res.json()
      // normalise profiles array → single object (Supabase join returns array)
      const newPosts: FeedPost[] = (data.posts ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : (p.profiles ?? null),
      }))
      setPosts(prev => append ? [...prev, ...newPosts] : newPosts)
      setHasMore(data.hasMore ?? false)
    } catch { /* silent */ }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => {
    setLoading(true); setPage(1)
    fetchPosts(1, false, activeFilter)
  }, [activeFilter, fetchPosts])

  const loadMore = async () => {
    setLoadingMore(true)
    const next = page + 1
    setPage(next)
    await fetchPosts(next, true, activeFilter)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .feed-grid { display: grid; grid-template-columns: 1fr 272px; gap: 1.5rem; max-width: 1080px; margin: 0 auto; padding: 1.5rem; align-items: start; }
        .feed-sidebar-col { position: sticky; top: 110px; display: flex; flex-direction: column; gap: 1rem; }
        @media (max-width: 800px) { .feed-grid { grid-template-columns: 1fr !important; padding: 1rem !important; gap: 0; } .feed-sidebar-col { display: none !important; } }
      `}</style>

      <div className="feed-grid">
        <main>
          <ComposerCard />

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
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
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>⏳ Loading feed…</div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
              <h3 style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No posts yet</h3>
              <p style={{ marginBottom: '1.5rem' }}>Be the first to share something!</p>
              <Link href="/create" style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>Create a post</Link>
            </div>
          ) : (
            <>
              {posts.map(post => <PostCard key={post.id} post={post} />)}
              {hasMore && (
                <button onClick={loadMore} disabled={loadingMore} style={{ display: 'block', width: '100%', padding: '0.85rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '10px', color: '#38bdf8', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem', fontFamily: 'inherit' }}>
                  {loadingMore ? 'Loading…' : 'Load more posts'}
                </button>
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
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>🌱 Today&apos;s Impact</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>₮4,280</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>contributed to Impact Fund today</div>
            <Link href="/impact" style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none' }}>See projects →</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
