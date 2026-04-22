'use client'
import { useState, useRef, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReactionType = 'trust' | 'love' | 'insightful' | 'collab'

export type FeedPost = {
  id: string
  user_id?: string
  author_id?: string
  content: string | null
  title?: string | null
  type: string
  media_url: string | null
  media_urls?: string[] | null      // multiple photos
  media_type?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  like_count?: number
  likes_count?: number
  comment_count?: number
  comments_count?: number
  save_count?: number
  saves_count?: number
  share_count?: number
  view_count?: number
  views_count?: number
  liked?: boolean
  saved?: boolean
  trust_score?: number
  reactions?: { trust: number; love: number; insightful: number; collab: number; total: number }
  user_reaction?: ReactionType | null
  top_comment?: { id: string; content: string; author_name: string | null } | null
  profiles: {
    id?: string
    full_name: string | null
    avatar_url: string | null
    username?: string | null
    trust_balance?: number | null
  } | null
  // Display override — when present, the header renders the org's
  // logo + name + link to /organisations/{slug} in place of the
  // human author's profile block. `profiles` stays set so we can
  // still show a "via @authorFirstName" subtitle for accountability.
  // See supabase/migrations/20260414000001_feed_posts_posted_as_org.sql
  // for the underlying column.
  posted_as_organisation_id?: string | null
  posted_as_organisation?: {
    id: string
    name: string
    slug: string | null
    logo_url: string | null
  } | null
  // Poll vote data (only present when type === 'poll')
  poll_vote_counts?: Record<number, number> | null
  user_poll_vote?: number | null
}

export const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: 'trust',      emoji: '👍', label: 'Trust',      color: '#38bdf8' },
  { type: 'love',       emoji: '❤️', label: 'Love',       color: '#f472b6' },
  { type: 'insightful', emoji: '💡', label: 'Insightful', color: '#fbbf24' },
  { type: 'collab',     emoji: '🤝', label: 'Collab',     color: '#34d399' },
]

type Comment = {
  id: string
  content: string
  created_at: string
  like_count?: number
  profiles: { id?: string; full_name: string | null; avatar_url: string | null; username?: string | null } | null
  liked_by_me?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  text:      { label: '✏️ Post',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  video:     { label: '🎬 Video',     color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
  short:     { label: '📱 Short',     color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
  photo:     { label: '📷 Photo',     color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  article:   { label: '📰 Article',   color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  listing:   { label: '🛍️ Listing',  color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  service:   { label: '🛠 Service',   color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  product:   { label: '📦 Product',   color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  job:       { label: '💼 Job',       color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  event:     { label: '📅 Event',     color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  poll:      { label: '📊 Poll',      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  link:      { label: '🔗 Link',      color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  milestone: { label: '🏆 Milestone', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
}

// ── Photo Grid ────────────────────────────────────────────────────────────────

function PhotoGrid({ urls, alt }: { urls: string[]; alt: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const count = urls.length

  const gridStyle = (): React.CSSProperties => {
    if (count === 1) return { display: 'block' }
    if (count === 2) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }
    if (count === 3) return { display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr', gap: '3px' }
    return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '3px' }
  }

  const itemStyle = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'relative', overflow: 'hidden', cursor: 'pointer', borderRadius: '6px',
      background: '#0f172a',
    }
    if (count === 1) return { ...base, borderRadius: '10px' }
    if (count === 3 && i === 0) return { ...base, gridRow: '1 / 3' }
    return base
  }

  return (
    <>
      <div style={{ ...gridStyle(), borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
        {urls.slice(0, 4).map((url, i) => (
          <div key={i} style={itemStyle(i)} onClick={() => setLightbox(i)}>
            <img
              src={url}
              alt={`${alt} ${i + 1}`}
              loading="lazy"
              style={{
                width: '100%',
                height: count === 1 ? 'auto' : '200px',
                maxHeight: count === 1 ? '500px' : '200px',
                objectFit: count === 1 ? 'contain' : 'cover',
                display: 'block',
              }}
            />
            {/* +N overlay for 4+ photos */}
            {i === 3 && count > 4 && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>+{count - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close"
          >✕</button>
          {lightbox > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(l => (l! > 0 ? l! - 1 : l)) }}
              style={{ position: 'absolute', left: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', color: '#fff', cursor: 'pointer' }}
            >‹</button>
          )}
          <img
            src={urls[lightbox]}
            alt={`${alt} ${lightbox + 1}`}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 60px rgba(0,0,0,0.6)' }}
          />
          {lightbox < urls.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(l => (l! < urls.length - 1 ? l! + 1 : l)) }}
              style={{ position: 'absolute', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', color: '#fff', cursor: 'pointer' }}
            >›</button>
          )}
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' }}>
            {urls.map((_, i) => (
              <div key={i} onClick={e => { e.stopPropagation(); setLightbox(i) }} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === lightbox ? '#38bdf8' : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'background 0.2s' }} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Video Player ──────────────────────────────────────────────────────────────

function VideoPlayer({ src, isShort }: { src: string; isShort: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)
  const [muted, setMuted] = useState(true)

  // Intersection observer for autoplay shorts
  useEffect(() => {
    if (!isShort) return
    const el = videoRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          el.play().then(() => setPlaying(true)).catch(() => {})
        } else {
          el.pause(); setPlaying(false)
        }
      },
      { threshold: 0.6 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isShort])

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) { el.play().then(() => setPlaying(true)).catch(() => {}); }
    else { el.pause(); setPlaying(false) }
  }

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000', marginBottom: '12px', cursor: 'pointer' }} onClick={togglePlay}>
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        loop={isShort}
        preload="metadata"
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? null)}
        style={{ width: '100%', maxHeight: isShort ? '480px' : '380px', display: 'block', objectFit: 'contain' }}
      />
      {/* Play overlay */}
      {!playing && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '22px', marginLeft: '4px' }}>▶</span>
          </div>
        </div>
      )}
      {/* Duration badge */}
      {duration !== null && !playing && (
        <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', color: '#fff', fontWeight: 600 }}>
          {formatDur(duration)}
        </div>
      )}
      {/* Mute toggle while playing */}
      {playing && (
        <button
          onClick={e => { e.stopPropagation(); setMuted(m => { if (videoRef.current) videoRef.current.muted = !m; return !m }) }}
          style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </div>
  )
}

// ── Share Sheet ───────────────────────────────────────────────────────────────

function ShareSheet({ postId, canonicalPath, text, onClose }: { postId: string; canonicalPath: string; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}${canonicalPath}` : canonicalPath
  const encoded = encodeURIComponent(url)
  const encodedText = encodeURIComponent(text.slice(0, 100) + ' — via FreeTrust')

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* fallback */ }
  }

  const options = [
    { icon: '🔗', label: copied ? 'Copied!' : 'Copy link', action: copy },
    { icon: '💬', label: 'WhatsApp', action: () => window.open(`https://wa.me/?text=${encodedText}%20${encoded}`, '_blank') },
    { icon: '𝕏', label: 'Twitter / X', action: () => window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}`, '_blank') },
    { icon: '💼', label: 'LinkedIn', action: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`, '_blank') },
    { icon: '📧', label: 'Email', action: () => window.open(`mailto:?subject=Check this out on FreeTrust&body=${encodedText}%20${encoded}`, '_blank') },
  ]

  return (
    <div style={{ marginTop: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Share post</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
      </div>
      {options.map(opt => (
        <button
          key={opt.label}
          onClick={opt.action}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid #1e293b', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.1s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', flexShrink: 0 }}>{opt.icon}</span>
          <span>{opt.label}</span>
          {opt.label === 'Copy link' && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
              /feed/{postId.slice(0, 8)}…
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Main PostCard ─────────────────────────────────────────────────────────────

export default function PostCard({
  post,
  expanded = false,
  currentUserId,
  onDelete,
}: {
  post: FeedPost
  expanded?: boolean
  currentUserId?: string
  onDelete?: (postId: string) => void
}) {
  const authorId = post.user_id ?? post.author_id ?? ''
  const likeInitial    = post.likes_count    ?? post.like_count    ?? 0
  const commentInitial = post.comments_count ?? post.comment_count ?? 0
  const saveInitial    = post.saves_count    ?? post.save_count    ?? 0

  const [liked,             setLiked]             = useState(post.liked ?? false)
  const [likeCount,         setLikeCount]         = useState(likeInitial)
  const [saved,             setSaved]             = useState(post.saved ?? false)
  const [saveCount,         setSaveCount]         = useState(saveInitial)
  const [showComments,      setShowComments]      = useState(expanded)
  const [comments,          setComments]          = useState<Comment[]>([])
  const [commentCount,      setCommentCount]      = useState(commentInitial)
  const [newComment,        setNewComment]        = useState('')
  const [submitting,        setSubmitting]        = useState(false)
  const [commentExpanded,   setCommentExpanded]   = useState(false)
  const [showShare,         setShowShare]         = useState(false)
  const [shareCount,        setShareCount]        = useState(post.share_count ?? 0)
  const [showMenu,          setShowMenu]          = useState(false)
  const [deleting,          setDeleting]          = useState(false)
  const [deleted,           setDeleted]           = useState(false)

  // Poll state (optimistic updates)
  const [localVoteCounts, setLocalVoteCounts] = useState<Record<number, number>>(post.poll_vote_counts ?? {})
  const [localUserVote, setLocalUserVote] = useState<number | null>(post.user_poll_vote ?? null)

  // Reactions
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [userReaction, setUserReaction]   = useState<ReactionType | null>(post.user_reaction ?? null)
  const [reactionTotal, setReactionTotal] = useState(post.reactions?.total ?? 0)
  const reactionPickerRef = useRef<HTMLDivElement | null>(null)
  const reactBtnWrapRef = useRef<HTMLDivElement | null>(null)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Close reaction picker on outside click
  useEffect(() => {
    if (!showReactionPicker) return
    const close = (e: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', close) }
  }, [showReactionPicker])

  const handleReact = async (type: ReactionType) => {
    setShowReactionPicker(false)
    // Optimistic update
    const wasReacted = userReaction
    if (wasReacted === type) {
      setUserReaction(null)
      setReactionTotal(t => Math.max(0, t - 1))
    } else if (wasReacted === null) {
      setUserReaction(type)
      setReactionTotal(t => t + 1)
    } else {
      setUserReaction(type)
      // total stays the same — switched type
    }
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const data = await res.json() as { user_reaction: ReactionType | null; total: number }
        setUserReaction(data.user_reaction)
        setReactionTotal(data.total)
      } else {
        // Roll back
        setUserReaction(wasReacted)
      }
    } catch {
      setUserReaction(wasReacted)
    }
  }

  const isOwner = !!currentUserId && currentUserId === authorId

  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/feed/posts/${post.id}`, { method: 'DELETE' })
      if (res.ok) { setDeleted(true); onDelete?.(post.id) }
    } catch { /* silent */ }
    finally { setDeleting(false); setShowMenu(false) }
  }

  const typeInfo  = TYPE_META[post.type] ?? TYPE_META.text

  // ── Canonical "read more" URL ─────────────────────────────────────────────
  // Jobs, events, and listings are synthesized by the feed API with a
  // prefixed id ("job-<uuid>", "event-<uuid>", "listing-<uuid>"). These
  // IDs don't exist in feed_posts so navigating to /feed/<prefixed-id>
  // returns a 404. Instead we derive the canonical destination URL:
  //   job-<uuid>     → /jobs/<uuid>
  //   event-<uuid>   → /events/<uuid>
  //   listing-<uuid> → /listings/<uuid>
  //   article-<uuid> → /articles/<uuid>
  //   <plain-uuid>   → /feed/<uuid>  (regular feed post)
  function getCanonicalUrl(postId: string, postType: string): string {
    if (postId.startsWith('job-'))     return `/jobs/${postId.slice(4)}`
    if (postId.startsWith('event-'))   return `/events/${postId.slice(6)}`
    if (postId.startsWith('listing-')) return `/listings/${postId.slice(8)}`
    if (postId.startsWith('article-')) return `/articles/${postId.slice(8)}`
    // For cross-table types without a prefix, use the type to route correctly
    if (postType === 'job')     return `/jobs/${postId}`
    if (postType === 'event')   return `/events/${postId}`
    if (postType === 'listing' || postType === 'service' || postType === 'product') return `/listings/${postId}`
    return `/feed/${postId}`
  }
  const canonicalUrl = getCanonicalUrl(post.id, post.type)

  // ── Author display — "post as organisation" override ─────────────────────
  // When post.posted_as_organisation is set, the card renders with the
  // org's branding (logo, name, link to /organisations/{slug}) in the
  // header, and adds a small "via @humanName" subtitle so the author
  // is still visible for accountability. When unset (default — every
  // personal post), the header falls back to the author's profile as
  // before.
  const postedAsOrg = post.posted_as_organisation ?? null
  const humanName   = post.profiles?.full_name ?? post.profiles?.username ?? 'Unknown'
  const humanAvatar = post.profiles?.avatar_url ?? null
  const humanId     = post.profiles?.id ?? null

  const name      = postedAsOrg ? postedAsOrg.name : humanName
  const avatarUrl = postedAsOrg ? postedAsOrg.logo_url : humanAvatar
  const trust     = postedAsOrg ? null : (post.profiles?.trust_balance ?? post.trust_score ?? null)
  // Link target — org profile for "as org" posts, personal profile
  // otherwise. Org links prefer slug, fall back to id if missing.
  const authorLinkHref = postedAsOrg
    ? (postedAsOrg.slug ? `/organisations/${postedAsOrg.slug}` : `/organisations/${postedAsOrg.id}`)
    : `/profile?id=${humanId ?? ''}`

  // Build media URL array
  const mediaUrls: string[] = (() => {
    const fromMeta = (post.metadata?.media_urls ?? post.media_urls) as string[] | undefined
    if (fromMeta && fromMeta.length > 0) return fromMeta
    if (post.media_url) return [post.media_url]
    return []
  })()

  const isVideo = post.type === 'video' || post.type === 'short' ||
    (post.media_type ?? '').startsWith('video/')
  const isShort = post.type === 'short'

  const handleLike = async () => {
    const prev = liked; setLiked(!prev); setLikeCount(c => prev ? c - 1 : c + 1)
    try { await fetch(`/api/feed/posts/${post.id}/like`, { method: 'POST' }) }
    catch { setLiked(prev); setLikeCount(c => prev ? c + 1 : c - 1) }
  }

  const handleSave = async () => {
    const prev = saved; setSaved(!prev); setSaveCount(c => prev ? c - 1 : c + 1)
    try { await fetch(`/api/feed/posts/${post.id}/save`, { method: 'POST' }) }
    catch { setSaved(prev); setSaveCount(c => prev ? c + 1 : c - 1) }
  }

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`)
      const d = await res.json()
      const rawComments: Comment[] = d.comments ?? []
      // Sync comment count to the real fetched count
      setCommentCount(rawComments.length)
      // Fetch Val likes for these comments
      if (rawComments.length > 0) {
        try {
          const ids = rawComments.map(c => c.id).join(',')
          const likesRes = await fetch(`/api/feed/comments/val-likes?ids=${ids}`)
          if (likesRes.ok) {
            const { userLikedIds } = await likesRes.json() as { userLikedIds: string[] }
            const userSet = new Set(userLikedIds)
            setComments(rawComments.map(c => ({ ...c, liked_by_me: userSet.has(c.id) })))
            return
          }
        } catch { /* fall through */ }
      }
      setComments(rawComments)
    } catch { /* silent */ }
  }, [post.id])

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) await loadComments()
    setShowComments(v => !v)
  }

  const submitComment = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (res.ok) { setNewComment(''); setCommentCount(c => c + 1); await loadComments() }
    } catch { /* silent */ }
    finally { setSubmitting(false) }
  }

  useEffect(() => { if (expanded) loadComments() }, [expanded, loadComments])

  // Auto-focus comment textarea when comments panel opens
  useEffect(() => {
    if (showComments) {
      const timer = setTimeout(() => commentTextareaRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [showComments])

  // Close owner menu on outside click — defer listener to next tick so
  // the opening click doesn't immediately trigger it
  useEffect(() => {
    if (!showMenu) return
    const close = () => setShowMenu(false)
    const timer = setTimeout(() => {
      document.addEventListener('click', close)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [showMenu])

  const shareText = post.title ?? post.content ?? ''

  // If deleted, vanish from feed instantly
  if (deleted) return null

  return (
    <article style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', marginBottom: '12px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px 10px', minWidth: 0, overflow: 'hidden' }}>
        <Link href={authorLinkHref} style={{ flexShrink: 0, textDecoration: 'none' }}>
          <Avatar url={avatarUrl} name={name} size={42} />
        </Link>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
            <Link href={authorLinkHref} style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{name}</Link>
            {postedAsOrg && (
              // Small chip marking this as an org byline so readers
              // can distinguish "a person posting" from "an org
              // posting". Keeps the accountability signal strong.
              <span style={{ fontSize: '10px', color: '#c4b5fd', background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', padding: '1px 7px', borderRadius: '20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Org</span>
            )}
            {trust !== null && trust > 0 && (
              <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.12)', padding: '1px 7px', borderRadius: '20px', fontWeight: 600 }}>₮{Math.round(trust)}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
            {/* Subtitle — for org posts, show "via @humanName" so the
                real author is still visible for accountability.
                For normal posts, show the author's @username. */}
            {postedAsOrg ? (
              humanId ? (
                <Link
                  href={`/profile?id=${humanId}`}
                  style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}
                >
                  via {humanName}
                </Link>
              ) : (
                <span style={{ fontSize: '12px', color: '#64748b' }}>via {humanName}</span>
              )
            ) : (
              post.profiles?.username && <span style={{ fontSize: '12px', color: '#475569' }}>@{post.profiles.username}</span>
            )}
            <span style={{ fontSize: '11px', color: '#334155' }}>·</span>
            <span style={{ fontSize: '12px', color: '#475569' }}>{formatTime(post.created_at)}</span>
          </div>
        </div>
        {/* Type badge */}
        {post.type !== 'text' && (
          <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: typeInfo.color, background: typeInfo.bg, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {typeInfo.label}
          </span>
        )}
        {/* ── Owner menu ── */}
        {isOwner && (
          <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{ background: 'none', border: 'none', color: '#475569', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px', lineHeight: 1 }}
              aria-label="Post options"
            >⋯</button>
            {showMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden', zIndex: 100, minWidth: '150px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', color: '#f87171', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span>🗑️</span>
                  <span>{deleting ? 'Deleting…' : 'Delete post'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '0 16px', minWidth: 0, overflow: 'hidden' }}>
        {post.title ? (
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px', lineHeight: 1.4, wordBreak: 'break-word' }}>{String(post.title)}</h3>
        ) : null}
        {/* For polls, content is stored as JSON — don't render it as body text;
            the poll UI block below handles rendering. */}
        {post.content && post.type !== 'poll' ? (
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#cbd5e1', margin: '0 0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {!expanded && post.content.length > 280
              ? <>{post.content.slice(0, 280)}<Link href={canonicalUrl} style={{ color: '#38bdf8', textDecoration: 'none' }}> …more</Link></>
              : post.content
            }
          </p>
        ) : null}
      </div>

      {/* ── Media ── */}
      {isVideo && mediaUrls.length > 0 ? (
        <div style={{ padding: '0 16px' }}>
          <VideoPlayer src={mediaUrls[0]} isShort={isShort} />
        </div>
      ) : mediaUrls.length > 0 ? (
        <div style={{ padding: '0 16px' }}>
          <PhotoGrid urls={mediaUrls} alt={name} />
        </div>
      ) : null}

      {/* Link preview */}
      {post.type === 'link' && post.metadata?.link_url ? (() => {
        const ogImg   = post.metadata.og_image   as string | undefined
        const ogTitle = post.metadata.og_title   as string | undefined
        const linkUrl = post.metadata.link_url   as string
        return (
          <div style={{ margin: '0 16px 12px', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden' }}>
            {ogImg ? <img src={ogImg} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }} /> : null}
            <div style={{ padding: '10px 14px' }}>
              {ogTitle ? <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>{ogTitle}</div> : null}
              <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#38bdf8', textDecoration: 'none' }}>
                {linkUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
          </div>
        )
      })() : null}

      {/* ── Poll ── */}
      {post.type === 'poll' && (() => {
        let pollData: { question?: string; options?: string[]; duration?: string } = {}
        try { pollData = JSON.parse(post.content ?? '{}') } catch { pollData = {} }
        const options = pollData.options ?? []
        const totalVotes = Object.values(localVoteCounts).reduce((a: number, b: number) => a + b, 0)

        // Expiry calculation
        const durationMap: Record<string, number> = { '1d': 86400000, '3d': 259200000, '7d': 604800000, '14d': 1209600000 }
        const durationMs = durationMap[pollData.duration ?? '7d'] ?? 604800000
        const createdAt = new Date(post.created_at).getTime()
        const expiresAt = createdAt + durationMs
        const isPollExpired = Date.now() > expiresAt
        const timeRemaining = (() => {
          if (isPollExpired) return 'Ended'
          const ms = expiresAt - Date.now()
          const hours = Math.floor(ms / 3600000)
          const days = Math.floor(hours / 24)
          if (days > 0) return `${days}d left`
          if (hours > 0) return `${hours}h left`
          return 'Ending soon'
        })()

        // Show results if user has voted OR poll has expired
        const hasVoted = localUserVote !== null || isPollExpired

        const handleVote = async (idx: number) => {
          if (isPollExpired) return
          // Optimistic update
          const prevVote = localUserVote
          const prevCounts = { ...localVoteCounts }
          const newCounts = { ...localVoteCounts }

          if (prevVote === idx) {
            // Toggle off
            setLocalUserVote(null)
            newCounts[idx] = Math.max(0, (newCounts[idx] ?? 0) - 1)
            if (newCounts[idx] === 0) delete newCounts[idx]
          } else {
            if (prevVote !== null) {
              // Remove old vote
              newCounts[prevVote] = Math.max(0, (newCounts[prevVote] ?? 0) - 1)
              if (newCounts[prevVote] === 0) delete newCounts[prevVote]
            }
            setLocalUserVote(idx)
            newCounts[idx] = (newCounts[idx] ?? 0) + 1
          }
          setLocalVoteCounts(newCounts)

          try {
            const res = await fetch(`/api/feed/posts/${post.id}/vote`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ optionIdx: idx }),
            })
            if (res.ok) {
              const data = await res.json() as { user_vote: number | null; counts: Record<number, number>; total: number }
              setLocalUserVote(data.user_vote)
              setLocalVoteCounts(data.counts ?? {})
            } else {
              const errData = await res.json().catch(() => ({})) as { expired?: boolean }
              if (errData.expired) {
                // Poll ended between load and vote — don't revert, just leave results visible
                console.warn('[poll] vote rejected: poll has ended')
              } else {
                // Revert on other errors
                setLocalUserVote(prevVote)
                setLocalVoteCounts(prevCounts)
              }
            }
          } catch {
            setLocalUserVote(prevVote)
            setLocalVoteCounts(prevCounts)
          }
        }

        return (
          <div style={{ margin: '0 16px 14px' }}>
            {options.map((opt, i) => {
              const votes = localVoteCounts[i] ?? 0
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
              const isChosen = localUserVote === i
              return (
                <button
                  key={i}
                  disabled={isPollExpired}
                  onClick={() => handleVote(i)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    position: 'relative', overflow: 'hidden',
                    background: isChosen ? 'rgba(56,189,248,0.1)' : 'rgba(15,23,42,0.6)',
                    border: isChosen ? '1px solid rgba(56,189,248,0.5)' : '1px solid #334155',
                    borderRadius: '10px', padding: '10px 14px', marginBottom: '8px',
                    cursor: isPollExpired ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'border-color 0.15s',
                    opacity: isPollExpired && !isChosen ? 0.7 : 1,
                  }}
                >
                  {/* Progress bar fill — shown after voting or when expired */}
                  {hasVoted && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: isChosen ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.07)',
                      transition: 'width 0.4s ease',
                      borderRadius: '10px',
                      pointerEvents: 'none',
                    }} />
                  )}
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '13px',
                      color: isChosen ? '#38bdf8' : '#cbd5e1',
                      fontWeight: isChosen ? 600 : 400,
                      lineHeight: 1.4,
                    }}>
                      {isChosen && <span style={{ marginRight: '4px' }}>✓</span>}{opt}
                    </span>
                    {hasVoted && (
                      <span style={{ fontSize: '12px', color: '#64748b', flexShrink: 0, fontWeight: 500 }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            <div style={{ fontSize: '11px', marginTop: '2px', display: 'flex', gap: '8px' }}>
              <span style={{ color: '#64748b' }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
              <span style={{ color: isPollExpired ? '#fbbf24' : '#64748b' }}>
                {isPollExpired ? '🔒 Poll ended' : `⏱ ${timeRemaining}`}
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── Top comment preview (inline) ── */}
      {post.top_comment && !showComments && (
        <Link
          href={canonicalUrl}
          style={{ display: 'block', margin: '8px 16px 0', padding: '8px 12px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 10, textDecoration: 'none' }}
        >
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>
            {post.top_comment.author_name ?? 'A member'}
          </div>
          <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {post.top_comment.content}
          </div>
        </Link>
      )}

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '10px 8px 10px', borderTop: '1px solid rgba(51,65,85,0.6)', marginTop: '10px', width: '100%', boxSizing: 'border-box' }}>
        {/* React button + picker */}
        <div ref={reactBtnWrapRef} style={{ position: 'relative' }}>
          <ActionBtn
            icon={userReaction
              ? (REACTIONS.find(r => r.type === userReaction)?.emoji ?? '👍')
              : '👍'}
            label={reactionTotal > 0
              ? reactionTotal.toString()
              : (userReaction ? (REACTIONS.find(r => r.type === userReaction)?.label ?? 'React') : 'React')}
            active={!!userReaction}
            onClick={(e) => {
              e?.stopPropagation()
              if (!showReactionPicker && reactBtnWrapRef.current) {
                const rect = reactBtnWrapRef.current.getBoundingClientRect()
                setPickerPos({ top: rect.top - 52, left: rect.left })
              }
              setShowReactionPicker(v => !v)
            }}
          />
          {showReactionPicker && pickerPos && (
            <div
              ref={reactionPickerRef}
              style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, marginBottom: 6, background: '#0f172a', border: '1px solid #334155', borderRadius: 999, padding: '6px 8px', display: 'flex', gap: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 9999 }}>
              {REACTIONS.map(r => {
                const isActive = userReaction === r.type
                return (
                  <button
                    key={r.type}
                    onClick={(e) => { e.stopPropagation(); handleReact(r.type) }}
                    title={r.label}
                    style={{
                      background: isActive ? `${r.color}22` : 'transparent',
                      border: isActive ? `1px solid ${r.color}66` : '1px solid transparent',
                      borderRadius: '50%', width: 36, height: 36, fontSize: 20, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 0.12s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.25)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                  >
                    {r.emoji}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <ActionBtn
          icon="💬"
          label={commentCount > 0 ? `${commentCount}` : 'Comment'}
          active={showComments}
          onClick={toggleComments}
        />
        <ActionBtn
          icon="📤"
          label={shareCount > 0 ? shareCount.toString() : 'Share'}
          active={showShare}
          onClick={() => { setShowShare(v => !v); if (!showShare) setShareCount(c => c + 1) }}
        />
        <ActionBtn
          icon={saved ? '🔖' : '🏷️'}
          label={saveCount > 0 ? saveCount.toString() : 'Save'}
          active={saved}
          onClick={handleSave}
        />
        <div style={{ flex: 1 }} />
        <Link
          href={authorLinkHref}
          style={{ flexShrink: 0, textDecoration: 'none', padding: '4px 4px 4px 8px' }}
          title={`View ${name}'s profile`}
        >
          <Avatar url={avatarUrl} name={name} size={28} />
        </Link>
      </div>

      {/* ── Share sheet ── */}
      {showShare && (
        <div style={{ padding: '0 16px 14px' }}>
          <ShareSheet postId={post.id} canonicalPath={canonicalUrl} text={shareText} onClose={() => setShowShare(false)} />
        </div>
      )}

      {/* ── Comments ── */}
      {showComments && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #1e293b' }}>
          <div style={{ paddingTop: '12px' }}>
            {comments.length === 0 && (
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px' }}>No comments yet — be first!</p>
            )}
            {comments.map(c => (
              <CommentRow
                key={c.id}
                comment={c}
                onLikeToggle={(commentId, liked, delta) => {
                  setComments(prev => prev.map(x =>
                    x.id === commentId
                      ? { ...x, liked_by_me: liked, like_count: Math.max(0, (x.like_count ?? 0) + delta) }
                      : x
                  ))
                }}
              />
            ))}
            {/* Comment composer */}
            <div style={{ marginTop: '8px' }}>
              {/* Textarea wrapper */}
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={commentTextareaRef}
                  style={{
                    width: '100%',
                    minHeight: commentExpanded ? '220px' : '60px',
                    maxHeight: commentExpanded ? '220px' : '150px',
                    background: 'rgba(56,189,248,0.05)',
                    border: '1px solid rgba(56,189,248,0.15)',
                    borderRadius: '12px',
                    padding: '10px 40px 10px 12px',
                    color: '#f1f5f9',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'none',
                    overflowY: commentExpanded ? 'auto' : 'hidden',
                    lineHeight: '1.5',
                    boxSizing: 'border-box',
                    display: 'block',
                    transition: 'min-height 0.15s, max-height 0.15s',
                  }}
                  placeholder="Write a comment…"
                  value={newComment}
                  maxLength={500}
                  rows={2}
                  onChange={e => {
                    setNewComment(e.target.value)
                    if (!commentExpanded) {
                      const el = e.target
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 150) + 'px'
                    }
                  }}
                  onKeyDown={() => { /* Enter adds newline naturally; no submit on Enter */ }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.15)' }}
                />
                {/* Expand/collapse toggle */}
                <button
                  type="button"
                  onClick={() => setCommentExpanded(v => !v)}
                  title={commentExpanded ? 'Collapse' : 'Expand for more space'}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(56,189,248,0.12)',
                    border: 'none',
                    borderRadius: '6px',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#38bdf8',
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  {commentExpanded ? '▲' : '▼'}
                </button>
              </div>

              {/* Character counter + Post button row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{
                  fontSize: '11px',
                  color: newComment.length > 450 ? '#f87171' : '#475569',
                  opacity: newComment.length > 0 ? 1 : 0,
                  transition: 'opacity 0.15s',
                }}>
                  {newComment.length} / 500
                </span>
                <button
                  onClick={submitComment}
                  disabled={submitting || !newComment.trim()}
                  style={{
                    background: '#38bdf8',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    cursor: submitting || !newComment.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: (submitting || !newComment.trim()) ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {submitting ? '…' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

// ── Comment Row ───────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  onLikeToggle,
}: {
  comment: Comment
  onLikeToggle: (id: string, liked: boolean, delta: number) => void
}) {
  const [liking, setLiking] = useState(false)
  const cName = comment.profiles?.full_name ?? comment.profiles?.username ?? 'FreeTrust Member'

  const handleLike = async () => {
    if (liking) return
    setLiking(true)
    const wasLiked = comment.liked_by_me ?? false
    onLikeToggle(comment.id, !wasLiked, wasLiked ? -1 : 1)
    try {
      await fetch(`/api/feed/comments/${comment.id}/like`, { method: 'POST' })
    } catch {
      // revert on error
      onLikeToggle(comment.id, wasLiked, wasLiked ? 1 : -1)
    } finally {
      setLiking(false)
    }
  }

  const likeCount = comment.like_count ?? 0
  const liked = comment.liked_by_me ?? false

  const profileHref = comment.profiles?.id ? `/profile?id=${comment.profiles.id}` : null

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-start' }}>
      {profileHref ? (
        <Link href={profileHref} style={{ flexShrink: 0, textDecoration: 'none' }}>
          <Avatar url={comment.profiles?.avatar_url ?? null} name={cName} size={30} />
        </Link>
      ) : (
        <Avatar url={comment.profiles?.avatar_url ?? null} name={cName} size={30} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '10px', padding: '8px 12px' }}>
          {profileHref ? (
            <Link href={profileHref} style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '2px', display: 'block', textDecoration: 'none' }}>{cName}</Link>
          ) : (
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '2px' }}>{cName}</div>
          )}
          <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{comment.content}</div>
        </div>
        {/* Like row + Val badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', marginLeft: '4px' }}>
          <button
            onClick={handleLike}
            disabled={liking}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              background: liked ? 'rgba(248,113,113,0.12)' : 'transparent',
              border: liked ? '1px solid rgba(248,113,113,0.25)' : '1px solid transparent',
              borderRadius: '20px', padding: '2px 8px',
              fontSize: '11px', fontWeight: 600,
              color: liked ? '#f87171' : '#64748b',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!liked) (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
            onMouseLeave={e => { if (!liked) (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
          >
            <span style={{ fontSize: '12px' }}>{liked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

        </div>
      </div>
    </div>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: (e?: ReactMouseEvent) => void }) {
  return (
    <>
      <style>{`
        .action-btn-label { display: inline; }
        @media (max-width: 380px) { .action-btn-label { display: none !important; } }
      `}</style>
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '3px', padding: '6px 8px',
          background: active ? 'rgba(56,189,248,0.1)' : 'none',
          border: 'none', borderRadius: '8px', cursor: 'pointer',
          fontSize: '13px', color: active ? '#38bdf8' : '#64748b',
          fontFamily: 'inherit', transition: 'all 0.15s', fontWeight: active ? 600 : 400,
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#38bdf8' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = active ? '#38bdf8' : '#64748b' }}
      >
        <span style={{ fontSize: '15px', lineHeight: 1 }}>{icon}</span>
        <span className="action-btn-label">{label}</span>
      </button>
    </>
  )
}
