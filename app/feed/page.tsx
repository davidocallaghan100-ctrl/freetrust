'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  username: string | null
}

type FeedPost = {
  id: string
  author_id: string
  content: string | null
  type: string
  media_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  like_count: number
  comment_count: number
  save_count: number
  profiles: Profile | null
}

type Comment = {
  id: string
  content: string
  created_at: string
  profiles: Profile | null
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  header: { borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '1.5rem 1.5rem 1rem' },
  headerInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: '1.5rem', fontWeight: 800, margin: 0 },
  newPostBtn: { background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
  avatar: { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', flexShrink: 0, overflow: 'hidden' },
  postCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '0.75rem' },
  postHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' },
  postMeta: { flex: 1 },
  authorName: { fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' },
  authorRole: { fontSize: '0.78rem', color: '#64748b' },
  postTime: { fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' },
  postContent: { fontSize: '0.92rem', lineHeight: 1.65, color: '#cbd5e1', marginBottom: '0.75rem', whiteSpace: 'pre-wrap' },
  typeBadge: { display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.5rem' },
  actions: { display: 'flex', gap: '1.5rem', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', padding: 0, transition: 'color 0.15s' },
  commentsSection: { marginTop: '1rem', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem' },
  commentItem: { display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', alignItems: 'flex-start' },
  commentBubble: { background: 'rgba(56,189,248,0.05)', borderRadius: 8, padding: '0.5rem 0.75rem', flex: 1 },
  commentInput: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  input: { flex: 1, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#f1f5f9', fontSize: '0.85rem', outline: 'none' },
  sendBtn: { background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
  loadMoreBtn: { display: 'block', width: '100%', padding: '0.85rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, color: '#38bdf8', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' },
  emptyState: { textAlign: 'center', padding: '4rem 2rem', color: '#64748b' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: 78 },
  sideCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' },
  sideTitle: { fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' },
  trendTag: { display: 'block', padding: '0.4rem 0', fontSize: '0.85rem', color: '#38bdf8', textDecoration: 'none', borderBottom: '1px solid rgba(56,189,248,0.06)' },
}

const avatarGradients = [
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]

function getGradient(str: string) {
  return avatarGradients[(str?.charCodeAt(0) ?? 0) % avatarGradients.length]
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].substring(0, 2)
}

function formatTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  text: { label: '✏️ Post', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  video: { label: '🎬 Video', color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
  article: { label: '📰 Article', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
  listing: { label: '🛍️ Listing', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  job: { label: '💼 Job', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  event: { label: '📅 Event', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  milestone: { label: '🏆 Milestone', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
}

const trending = ['#TrustEconomy', '#FreelanceLife', '#ImpactInvesting', '#BuildInPublic', '#SustainableBusiness', '#CreatorEconomy']

function PostCard({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [saved, setSaved] = useState(false)
  const [saveCount, setSaveCount] = useState(post.save_count)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const typeInfo = TYPE_LABELS[post.type] ?? TYPE_LABELS.text
  const name = post.profiles?.full_name ?? post.profiles?.username ?? 'Unknown'
  const initials = getInitials(name)
  const avatarUrl = post.profiles?.avatar_url

  const handleLike = async () => {
    const prev = liked
    setLiked(!prev)
    setLikeCount(c => prev ? c - 1 : c + 1)
    try {
      await fetch(`/api/feed/posts/${post.id}/like`, { method: 'POST' })
    } catch {
      setLiked(prev)
      setLikeCount(c => prev ? c + 1 : c - 1)
    }
  }

  const handleSave = async () => {
    const prev = saved
    setSaved(!prev)
    setSaveCount(c => prev ? c - 1 : c + 1)
    try {
      await fetch(`/api/feed/posts/${post.id}/save`, { method: 'POST' })
    } catch {
      setSaved(prev)
      setSaveCount(c => prev ? c + 1 : c - 1)
    }
  }

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`)
      const data = await res.json()
      setComments(data.comments ?? [])
    } catch {
      // ignore
    }
  }

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      await loadComments()
    }
    setShowComments(v => !v)
  }

  const submitComment = async () => {
    if (!newComment.trim()) return
    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (res.ok) {
        setNewComment('')
        setCommentCount(c => c + 1)
        await loadComments()
      }
    } catch {
      // ignore
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
      <div style={S.postCard}>
      <div style={S.postHeader}>
        <Avatar url={avatarUrl} name={name} size={40} />
        <div style={S.postMeta}>
          <div style={S.authorName}>{name}</div>
          {post.profiles?.username && (
            <div style={S.authorRole}>@{post.profiles.username}</div>
          )}
        </div>
        <span style={S.postTime}>{formatTime(post.created_at)}</span>
      </div>

      {post.type !== 'text' && (
        <span style={{ ...S.typeBadge, color: typeInfo.color, background: typeInfo.bg }}>
          {typeInfo.label}
        </span>
      )}

      {post.content && <p style={S.postContent}>{post.content}</p>}

      {post.type === 'video' && post.media_url && (
        <video
          src={post.media_url}
          autoPlay
          muted
          loop
          playsInline
          controls
          style={{ width: '100%', borderRadius: 8, marginBottom: '0.75rem', maxHeight: 400 }}
        />
      )}

      {post.type !== 'video' && post.media_url && (
        <img
          src={post.media_url}
          alt="post media"
          style={{ width: '100%', borderRadius: 8, marginBottom: '0.75rem', maxHeight: 400, objectFit: 'cover' }}
        />
      )}

      <div style={S.actions}>
        <button style={{ ...S.actionBtn, color: liked ? '#38bdf8' : '#64748b' }} onClick={handleLike}>
          {liked ? '❤️' : '🤍'} {likeCount}
        </button>
        <button style={{ ...S.actionBtn, color: showComments ? '#38bdf8' : '#64748b' }} onClick={toggleComments}>
          💬 {commentCount}
        </button>
        <button style={{ ...S.actionBtn, color: saved ? '#38bdf8' : '#64748b' }} onClick={handleSave}>
          {saved ? '🔖' : '🏷️'} {saveCount > 0 ? saveCount : 'Save'}
        </button>
      </div>

      {showComments && (
        <div style={S.commentsSection}>
          {comments.map(c => {
            const cName = c.profiles?.full_name ?? c.profiles?.username ?? 'User'
            const cInitials = getInitials(cName)
            return (
              <div key={c.id} style={S.commentItem}>
                <div style={{ ...S.avatar, width: 30, height: 30, fontSize: '0.7rem', background: getGradient(cInitials) }}>
                  {c.profiles?.avatar_url
                    ? <img src={c.profiles.avatar_url} alt={cName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : cInitials.toUpperCase()}
                </div>
                <div style={S.commentBubble}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.2rem' }}>{cName}</div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{c.content}</div>
                </div>
              </div>
            )
          })}
          {comments.length === 0 && (
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.5rem' }}>No comments yet. Be the first!</p>
          )}
          <div style={S.commentInput}>
            <input
              style={S.input}
              placeholder="Write a comment…"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
            />
            <button style={S.sendBtn} onClick={submitComment} disabled={submittingComment}>
              {submittingComment ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPosts = useCallback(async (pageNum: number, append = false) => {
    try {
      const res = await fetch(`/api/feed/posts?page=${pageNum}`)
      const data = await res.json()
      const newPosts: FeedPost[] = data.posts ?? []
      setPosts(prev => append ? [...prev, ...newPosts] : newPosts)
      setHasMore(data.hasMore ?? false)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts(1, false)
  }, [fetchPosts])

  const loadMore = async () => {
    setLoadingMore(true)
    const nextPage = page + 1
    setPage(nextPage)
    await fetchPosts(nextPage, true)
  }

  return (
    <div style={S.page}>
      <style>{`
        .feed-layout { display: grid; grid-template-columns: 1fr 300px; gap: 2rem; max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; align-items: start; }
        .feed-sidebar { display: flex; flex-direction: column; gap: 1.25rem; position: sticky; top: 78px; }
        @media (max-width: 768px) {
          .feed-layout { grid-template-columns: 1fr !important; padding: 1rem !important; gap: 1rem !important; }
          .feed-sidebar { display: none !important; }
        }
        .action-btn:hover { color: #38bdf8 !important; }
        .load-more-btn:hover { background: rgba(56,189,248,0.15) !important; }
      `}</style>

      <div style={S.header}>
        <div style={S.headerInner}>
          <div>
            <h1 style={S.h1}>Community Feed</h1>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.25rem', marginBottom: 0 }}>
              What&apos;s happening in the FreeTrust community
            </p>
          </div>
          <Link href="/feed/new" style={S.newPostBtn}>✏️ New Post</Link>
        </div>
      </div>

      <div className="feed-layout">
        <main>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              Loading feed…
            </div>
          ) : posts.length === 0 ? (
            <div style={S.emptyState}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
              <h3 style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No posts yet</h3>
              <p style={{ marginBottom: '1.5rem' }}>Be the first to share something with the community!</p>
              <Link href="/feed/new" style={S.newPostBtn}>Create the first post</Link>
            </div>
          ) : (
            <>
              {posts.map(post => <PostCard key={post.id} post={post} />)}
              {hasMore && (
                <button
                  className="load-more-btn"
                  style={S.loadMoreBtn}
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load more posts'}
                </button>
              )}
            </>
          )}
        </main>

        <aside className="feed-sidebar" style={S.sidebar}>
          <div style={S.sideCard}>
            <div style={S.sideTitle}>Trending Topics</div>
            {trending.map(tag => (
              <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} style={S.trendTag}>{tag}</Link>
            ))}
          </div>

          <div style={{ ...S.sideCard, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
            <div style={S.sideTitle}>🌱 Today&apos;s Impact</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>₮4,280</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>contributed to Impact Fund today</div>
            <Link href="/impact" style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none' }}>See projects →</Link>
          </div>

          <div style={S.sideCard}>
            <div style={S.sideTitle}>Post Types</div>
            {Object.entries(TYPE_LABELS).map(([, info]) => (
              <div key={info.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ ...S.typeBadge, color: info.color, background: info.bg, marginBottom: 0 }}>{info.label}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
