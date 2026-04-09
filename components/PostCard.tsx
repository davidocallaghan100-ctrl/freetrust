'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  profiles: {
    id?: string
    full_name: string | null
    avatar_url: string | null
    username?: string | null
    trust_balance?: number | null
  } | null
}

type Comment = {
  id: string
  content: string
  created_at: string
  profiles: { full_name: string | null; avatar_url: string | null; username?: string | null } | null
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

function ShareSheet({ postId, text, onClose }: { postId: string; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/feed/${postId}` : `/feed/${postId}`
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
}: {
  post: FeedPost
  expanded?: boolean
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
  const [showShare,         setShowShare]         = useState(false)
  const [shareCount,        setShareCount]        = useState(post.share_count ?? 0)

  const typeInfo  = TYPE_META[post.type] ?? TYPE_META.text
  const name      = post.profiles?.full_name ?? post.profiles?.username ?? 'Unknown'
  const avatarUrl = post.profiles?.avatar_url ?? null
  const trust     = post.profiles?.trust_balance ?? post.trust_score ?? null

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
      setComments(d.comments ?? [])
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

  const shareText = post.title ?? post.content ?? ''

  return (
    <article style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', marginBottom: '12px', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px 10px' }}>
        <Link href={`/profile?id=${authorId}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
          <Avatar url={avatarUrl} name={name} size={42} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Link href={`/profile?id=${authorId}`} style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9', textDecoration: 'none' }}>{name}</Link>
            {trust !== null && trust > 0 && (
              <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.12)', padding: '1px 7px', borderRadius: '20px', fontWeight: 600 }}>₮{Math.round(trust)}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
            {post.profiles?.username && <span style={{ fontSize: '12px', color: '#475569' }}>@{post.profiles.username}</span>}
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
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '0 16px' }}>
        {post.title ? (
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px', lineHeight: 1.4 }}>{String(post.title)}</h3>
        ) : null}
        {post.content ? (
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#cbd5e1', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
            {!expanded && post.content.length > 280
              ? <>{post.content.slice(0, 280)}<Link href={`/feed/${post.id}`} style={{ color: '#38bdf8', textDecoration: 'none' }}> …more</Link></>
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

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0 8px 10px', borderTop: '1px solid rgba(51,65,85,0.6)', marginTop: '10px', paddingTop: '10px', overflowX: 'hidden' }}>
        <ActionBtn
          icon={liked ? '❤️' : '🤍'}
          label={likeCount > 0 ? likeCount.toString() : 'Like'}
          active={liked}
          onClick={handleLike}
        />
        <ActionBtn
          icon="💬"
          label={commentCount > 0 ? commentCount.toString() : 'Comment'}
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
          href={`/feed/${post.id}`}
          style={{ fontSize: '11px', color: '#334155', textDecoration: 'none', padding: '4px 8px' }}
          title="Open post"
        >
          🔗
        </Link>
      </div>

      {/* ── Share sheet ── */}
      {showShare && (
        <div style={{ padding: '0 16px 14px' }}>
          <ShareSheet postId={post.id} text={shareText} onClose={() => setShowShare(false)} />
        </div>
      )}

      {/* ── Comments ── */}
      {showComments && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #1e293b' }}>
          <div style={{ paddingTop: '12px' }}>
            {comments.length === 0 && (
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px' }}>No comments yet — be first!</p>
            )}
            {comments.map(c => {
              const cName = c.profiles?.full_name ?? c.profiles?.username ?? 'User'
              return (
                <div key={c.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-start' }}>
                  <Avatar url={c.profiles?.avatar_url ?? null} name={cName} size={30} />
                  <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '10px', padding: '8px 12px', flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '2px' }}>{cName}</div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>{c.content}</div>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <input
                style={{ flex: 1, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
                placeholder="Write a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
              />
              <button
                onClick={submitComment}
                disabled={submitting || !newComment.trim()}
                style={{ background: '#38bdf8', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: '#0f172a', cursor: 'pointer', fontFamily: 'inherit', opacity: (submitting || !newComment.trim()) ? 0.5 : 1 }}
              >
                {submitting ? '…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
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
