'use client'
import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Post {
  id: string
  title: string
  body: string
  type: string
  upvotes: number
  comment_count: number
  is_pinned: boolean
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null }
}

interface Comment {
  id: string
  body: string
  created_at: string
  upvotes: number
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function formatBody(body: string) {
  return body.split('\n').map((line, i) => {
    const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return (
      <p key={i} style={{ margin: '0 0 0.85rem', lineHeight: 1.75 }}
        dangerouslySetInnerHTML={{ __html: boldLine || '&nbsp;' }} />
    )
  })
}

function Avatar({ url, name, size = 36 }: { url?: string | null; name?: string | null; size?: number }) {
  const ini = initials(name)
  if (url) return <img src={url} alt={name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.32) + 'px', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
      {ini}
    </div>
  )
}

const TYPE_COLOR: Record<string, string> = {
  discussion: '#38bdf8', announcement: '#f472b6', question: '#fbbf24',
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PostPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params)

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [upvotes, setUpvotes] = useState(0)
  const [voted, setVoted] = useState(false)
  const [commentVotes, setCommentVotes] = useState<Set<string>>(new Set())
  const [communityName, setCommunityName] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      // Get community name
      const { data: community } = await supabase
        .from('communities')
        .select('name')
        .eq('slug', slug)
        .single()
      if (community) setCommunityName(community.name)

      // Get post
      const { data: postData, error: postErr } = await supabase
        .from('community_posts')
        .select('*, author:profiles!author_id(id, full_name, avatar_url)')
        .eq('id', id)
        .single()

      if (postErr || !postData) {
        setLoading(false)
        return
      }
      setPost(postData as unknown as Post)
      setUpvotes(postData.upvotes ?? 0)

      // Get comments
      const { data: commentsData } = await supabase
        .from('community_post_comments')
        .select('*, author:profiles!author_id(id, full_name, avatar_url)')
        .eq('post_id', id)
        .order('created_at', { ascending: true })
      setComments((commentsData ?? []) as unknown as Comment[])

      setLoading(false)
    }

    load()
  }, [slug, id])

  const handleVote = async () => {
    if (voted) return
    setVoted(true)
    setUpvotes(p => p + 1)
    // Optimistic — update in DB
    const supabase = createClient()
    await supabase
      .from('community_posts')
      .update({ upvotes: upvotes + 1 })
      .eq('id', id)
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUserId) return
    setSubmitting(true)

    const supabase = createClient()
    const { data: inserted, error } = await supabase
      .from('community_post_comments')
      .insert({
        post_id: id,
        author_id: currentUserId,
        body: newComment.trim(),
        upvotes: 0,
      })
      .select('*, author:profiles!author_id(id, full_name, avatar_url)')
      .single()

    if (!error && inserted) {
      setComments(prev => [...prev, inserted as unknown as Comment])
      // Increment comment_count on post
      await supabase
        .from('community_posts')
        .update({ comment_count: (post?.comment_count ?? 0) + comments.length + 1 })
        .eq('id', id)
    } else {
      // Fallback: show optimistically
      setComments(prev => [...prev, {
        id: String(Date.now()),
        body: newComment.trim(),
        created_at: new Date().toISOString(),
        upvotes: 0,
        author: { id: currentUserId, full_name: 'You', avatar_url: null },
      }])
    }
    setNewComment('')
    setSubmitting(false)
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  // ── Post not found ─────────────────────────────────────────────────────────
  if (!post) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', paddingTop: 64 }}>
        <div style={{ fontSize: '3rem' }}>💬</div>
        <h2 style={{ margin: 0 }}>Post not found</h2>
        <Link href={`/community/${slug}`} style={{ color: '#38bdf8', fontSize: '0.9rem' }}>← Back to {communityName || 'community'}</Link>
      </div>
    )
  }

  const typeColor = TYPE_COLOR[post.type] ?? '#38bdf8'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingBottom: '4rem' }}>
      <style>{`
        @media (max-width: 768px) { .post-wrap { padding: 1rem !important; padding-top: 80px !important; } }
      `}</style>

      <div className="post-wrap" style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem', paddingTop: '5.5rem' }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap' }}>
          <Link href="/community" style={{ color: '#64748b', textDecoration: 'none' }}>Communities</Link>
          <span>›</span>
          <Link href={`/community/${slug}`} style={{ color: '#64748b', textDecoration: 'none' }}>{communityName || slug}</Link>
          <span>›</span>
          <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{post.title}</span>
        </div>

        {/* Post card */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.75rem', marginBottom: '1.5rem' }}>
          {/* Type badge */}
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', background: `${typeColor}18`, border: `1px solid ${typeColor}30`, borderRadius: 999, padding: '0.15rem 0.6rem', color: typeColor, fontWeight: 700 }}>
              {post.type}
            </span>
            {post.is_pinned && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 999, padding: '0.15rem 0.55rem', color: '#fbbf24', fontWeight: 700 }}>📌 Pinned</span>
            )}
          </div>

          {/* Author */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <Avatar url={post.author?.avatar_url} name={post.author?.full_name} size={44} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>{post.author?.full_name ?? 'Unknown'}</div>
              <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 'clamp(1.2rem,4vw,1.6rem)', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, marginBottom: '1.25rem', margin: '0 0 1.25rem' }}>{post.title}</h1>

          {/* Body */}
          {post.body && (
            <div style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.75, marginBottom: '1.5rem' }}>
              {formatBody(post.body)}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(56,189,248,0.08)' }}>
            <button
              onClick={handleVote}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: voted ? 'rgba(56,189,248,0.1)' : 'rgba(148,163,184,0.08)', border: voted ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 700, color: voted ? '#38bdf8' : '#94a3b8', cursor: voted ? 'default' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
            >
              ▲ {upvotes} {upvotes === 1 ? 'upvote' : 'upvotes'}
            </button>
            <span style={{ fontSize: '0.82rem', color: '#475569' }}>💬 {comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
          </div>
        </div>

        {/* Comments */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem', color: '#f1f5f9' }}>
            Comments {comments.length > 0 ? `(${comments.length})` : ''}
          </h2>

          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748b', fontSize: '0.88rem' }}>
              No comments yet — be the first!
            </div>
          )}

          {comments.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: i < comments.length - 1 ? '1px solid rgba(56,189,248,0.06)' : 'none' }}>
              <Avatar url={c.author?.avatar_url} name={c.author?.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f1f5f9' }}>{c.author?.full_name ?? 'Member'}</span>
                  <span style={{ fontSize: '0.73rem', color: '#475569' }}>
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 0.5rem' }}>{c.body}</p>
                <button
                  onClick={() => setCommentVotes(prev => { const n = new Set(prev); if (!n.has(c.id)) n.add(c.id); return n })}
                  style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: commentVotes.has(c.id) ? '#38bdf8' : '#475569', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                >
                  ▲ {(c.upvotes ?? 0) + (commentVotes.has(c.id) ? 1 : 0)}
                </button>
              </div>
            </div>
          ))}

          {/* Add comment */}
          <form onSubmit={handleComment} style={{ marginTop: comments.length > 0 ? '0.5rem' : '0' }}>
            {!currentUserId && (
              <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.85rem', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, fontSize: '0.82rem', color: '#64748b' }}>
                <Link href={`/login?redirect=/community/${slug}/post/${id}`} style={{ color: '#38bdf8', fontWeight: 600 }}>Sign in</Link> to leave a comment
              </div>
            )}
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={currentUserId ? 'Add a comment…' : 'Sign in to comment…'}
              disabled={!currentUserId}
              rows={3}
              style={{ width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.88rem', color: '#f1f5f9', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'system-ui', marginBottom: '0.75rem', opacity: currentUserId ? 1 : 0.5 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting || !currentUserId}
                style={{ background: newComment.trim() && currentUserId ? '#38bdf8' : 'rgba(56,189,248,0.3)', border: 'none', borderRadius: 7, padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: newComment.trim() && currentUserId ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                {submitting ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
