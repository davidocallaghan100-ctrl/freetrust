'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '@/components/Avatar'
import Link from 'next/link'
import type { StoryAuthorGroup, StoryRecord } from '@/types/stories'
import { FEED_AUDIO_PLAY_EVENT, announceFeedAudioPlayback, generateFeedPlayerId } from '@/lib/feed/audioCoordinator'

const SHARED_POST_TYPE_LABEL: Record<string, string> = {
  text: '✏️ Post', video: '🎬 Video', short: '📱 Short', photo: '📷 Photo',
  music: '🎵 Music', article: '📰 Article', listing: '🛍️ Listing', service: '🛠 Service',
  product: '📦 Product', job: '💼 Job', event: '📅 Event', activity: '🏃 Activity',
  poll: '📊 Poll', link: '🔗 Link', milestone: '🏆 Milestone',
}

// ── Relative time helper (kept local + tiny — most of the app formats dates
// inline per-component rather than importing a shared date lib) ────────────
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function usesReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

interface ViewerSheetViewer {
  viewer_id: string
  viewed_at: string
  profiles?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface StoryViewerProps {
  groups: StoryAuthorGroup[]
  startGroupIndex: number
  startStoryIndex?: number
  currentUserId: string
  /**
   * 'stories' — full behavior: progress bars auto-advance, calls
   *   record_story_view, auto-advances to the next author's set.
   * 'memories' — a single author's permanent Memories, navigable left/right
   *   only. No expiry countdown, no cross-author auto-advance chain.
   */
  mode: 'stories' | 'memories'
  onClose: () => void
  /** Stories mode only — refresh the bar (e.g. after Save as Memory / delete). */
  onStoryChanged?: () => void
}

// Card-style render for media_type === 'shared_post' stories — these have
// no single image/video to fill the frame, so instead we render the
// snapshot captured at share time (see share_post_as_story RPC): original
// author, post type badge, title/content excerpt, and a media thumbnail
// when the source post had one (photo/video/music/link posts etc).
function SharedPostStoryCard({ story }: { story: StoryRecord }) {
  const snap = story.shared_post_snapshot
  if (!snap) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ft-text-tertiary)', fontSize: 13, padding: 20, textAlign: 'center' }}>
        This shared post is no longer available.
      </div>
    )
  }
  const typeLabel = SHARED_POST_TYPE_LABEL[snap.post_type] || '📝 Post'
  const hasThumb = !!snap.media_url && (snap.media_type === 'image' || snap.media_type === 'photo' || snap.media_type === 'video')

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(160deg, var(--ft-surface) 0%, var(--ft-bg) 100%)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {hasThumb ? (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
          {snap.media_type === 'video' ? (
            <video src={snap.media_url!} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={snap.media_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.75) 100%)' }} />
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <div style={{ padding: '1.1rem 1.2rem', paddingBottom: hasThumb ? '1.4rem' : '1.1rem', marginTop: hasThumb ? -70 : 0, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(56,189,248,.16)', color: '#7dd3fc' }}>
            {typeLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Avatar url={snap.author_avatar_url} name={snap.author_name} size={28} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{snap.author_name}</div>
        </div>
        {snap.title && (
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{snap.title}</div>
        )}
        {snap.content && (
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.85)', lineHeight: 1.45, maxHeight: 96, overflow: 'hidden' }}>
            {snap.content.length > 220 ? `${snap.content.slice(0, 220)}…` : snap.content}
          </div>
        )}
        {story.shared_post_id && (
          <Link
            href={`/feed/${story.shared_post_id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 13, fontWeight: 700, color: 'var(--ft-bg)', background: 'linear-gradient(135deg,var(--ft-accent),#00d4aa)', padding: '0.55rem 0.9rem', borderRadius: 999, textDecoration: 'none' }}
          >
            View post →
          </Link>
        )}
      </div>
    </div>
  )
}

export default function StoryViewer({
  groups,
  startGroupIndex,
  startStoryIndex = 0,
  currentUserId,
  mode,
  onClose,
  onStoryChanged,
}: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(startStoryIndex)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1 within current story
  const [viewersOpen, setViewersOpen] = useState(false)
  const [viewers, setViewers] = useState<ViewerSheetViewer[]>([])
  const [viewersLoading, setViewersLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(Date.now())
  const pausedAccumRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reducedMotion = useMemo(usesReducedMotion, [])
  // Stories' own video sound never coordinated with the rest of the feed's
  // single-audio-source rule (see lib/feed/audioCoordinator.ts) — a story
  // could play audible video sound at the same time as an already-playing
  // feed video, soundtrack, or (since the global music player persists
  // across route navigation) a Music post track. This mirrors the same
  // playerId/announce/yield pattern PostCard's VideoPlayer uses: mute
  // (not pause) when another player announces, and announce right before
  // this story's own video goes audible.
  const storyPlayerIdRef = useRef(generateFeedPlayerId('ft-story'))
  const [storyVideoMuted, setStoryVideoMuted] = useState(false)

  const group = groups[groupIndex]
  const story: StoryRecord | undefined = group?.stories[storyIndex]
  const isOrgGroup = !!group?.org
  // For personal groups, "owner" means it's literally your own group. For
  // org groups, it means the viewer currently holds an owner/admin role in
  // that org (group.canManage, computed server-side in GET /api/stories) —
  // NOT whether they happen to be group.user.id, since that's the org's id.
  const isOwner = isOrgGroup ? !!group?.canManage : group?.user.id === currentUserId

  const durationMs = story ? story.duration_seconds * 1000 : 5000

  // Yield to whichever feed audio source most recently announced itself as
  // audible (another story's video, a feed VideoPlayer, a PhotoCarousel
  // soundtrack, or the global Music post player) — mutes rather than
  // pauses so this story's own playback/progress timing is unaffected.
  useEffect(() => {
    const yieldToAnotherPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail
      if (detail?.playerId === storyPlayerIdRef.current) return
      setStoryVideoMuted(true)
    }
    window.addEventListener(FEED_AUDIO_PLAY_EVENT, yieldToAnotherPlayer)
    return () => window.removeEventListener(FEED_AUDIO_PLAY_EVENT, yieldToAnotherPlayer)
  }, [])

  // Each time a new video story becomes active, it tries sound-on by
  // default (matching feed video behavior) and announces itself — before
  // calling play() — so any other currently-audible feed player yields
  // first. (Sequenced imperatively via videoRef instead of the `autoPlay`
  // attribute so the announce always happens before playback can start.)
  useEffect(() => {
    if (!story || story.media_type !== 'video') return
    setStoryVideoMuted(false)
    announceFeedAudioPlayback(storyPlayerIdRef.current)
    videoRef.current?.play().catch(() => { /* autoplay may be blocked until user gesture */ })
  }, [story?.id, story?.media_type])

  // ── Record view on display (stories mode only — memories don't track views) ──
  useEffect(() => {
    if (!story || mode !== 'stories') return
    fetch(`/api/stories/${story.id}/view`, { method: 'POST' }).catch(() => { /* silent */ })
  }, [story?.id, mode])

  // ── Progress / auto-advance loop ────────────────────────────────────────────
  const goNextStory = useCallback(() => {
    if (!group) return
    if (storyIndex + 1 < group.stories.length) {
      setStoryIndex(i => i + 1)
      return
    }
    // Author's set finished.
    if (mode === 'memories') {
      onClose()
      return
    }
    if (groupIndex + 1 < groups.length) {
      setGroupIndex(g => g + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }, [group, storyIndex, groupIndex, groups.length, mode, onClose])

  const goPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1)
      return
    }
    if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex(g => g - 1)
      setStoryIndex(Math.max(0, prevGroup.stories.length - 1))
    }
  }, [storyIndex, groupIndex, groups])

  // Reset progress whenever the active story changes.
  useEffect(() => {
    setProgress(0)
    startedAtRef.current = Date.now()
    pausedAccumRef.current = 0
    setViewersOpen(false)
    setDeleteConfirm(false)
  }, [groupIndex, storyIndex])

  useEffect(() => {
    if (!story) return
    if (story.media_type === 'video') return // videos drive their own progress via onTimeUpdate
    if (mode === 'memories') return // memories mode: no auto-advance timer at all

    let cancelled = false
    const tick = () => {
      if (cancelled) return
      if (paused) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const elapsed = Date.now() - startedAtRef.current - pausedAccumRef.current
      const pct = Math.min(1, elapsed / durationMs)
      setProgress(pct)
      if (pct >= 1) {
        goNextStory()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [story?.id, paused, durationMs, goNextStory, mode])

  // Track pause duration so resuming doesn't jump the progress bar.
  const pauseStartRef = useRef<number | null>(null)
  useEffect(() => {
    if (paused) {
      pauseStartRef.current = Date.now()
      videoRef.current?.pause()
    } else {
      if (pauseStartRef.current) {
        pausedAccumRef.current += Date.now() - pauseStartRef.current
        pauseStartRef.current = null
      }
      videoRef.current?.play().catch(() => { /* autoplay may be blocked until user gesture */ })
    }
  }, [paused])

  // Video-driven progress.
  const onVideoTimeUpdate = () => {
    const v = videoRef.current
    if (!v || !v.duration) return
    setProgress(Math.min(1, v.currentTime / v.duration))
  }
  const onVideoEnded = () => {
    if (mode === 'memories') return
    goNextStory()
  }

  // ── Keyboard (Escape closes on desktop) ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNextStory()
      if (e.key === 'ArrowLeft') goPrevStory()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, goNextStory, goPrevStory])

  // ── Swipe down to close ──────────────────────────────────────────────────────
  const touchStartY = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const delta = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null
    if (delta > 90) onClose()
  }

  // ── Viewers sheet (owner only) ───────────────────────────────────────────────
  const openViewers = async () => {
    if (!story) return
    setViewersOpen(true)
    setViewersLoading(true)
    setPaused(true)
    try {
      const res = await fetch(`/api/stories/${story.id}/views`)
      if (res.ok) {
        const data = await res.json() as { views: ViewerSheetViewer[] }
        setViewers(data.views ?? [])
      }
    } catch { /* silent */ }
    setViewersLoading(false)
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleSaveAsMemory = async () => {
    if (!story) return
    try {
      const res = await fetch(`/api/stories/${story.id}/save-as-memory`, { method: 'POST' })
      if (res.ok) {
        showToast('💾 Saved to your Memories')
        onStoryChanged?.()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Could not save — try again')
      }
    } catch {
      showToast('Network error — try again')
    }
  }

  const handleDelete = async () => {
    if (!story) return
    try {
      const res = await fetch(`/api/stories/${story.id}`, { method: 'DELETE' })
      if (res.ok) {
        onStoryChanged?.()
        goNextStory()
      } else {
        showToast('Could not delete — try again')
      }
    } catch {
      showToast('Network error — try again')
    }
    setDeleteConfirm(false)
  }

  if (!group || !story) return null

  const displayName = group.user.full_name || 'FreeTrust member'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Story from ${displayName}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', background: 'var(--ft-bg)', overflow: 'hidden' }}>

        {/* Media */}
        {story.media_type === 'image' ? (
          <img
            src={story.media_url}
            alt={story.caption || `Story from ${displayName}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : story.media_type === 'video' ? (
          <video
            ref={videoRef}
            src={story.media_url}
            playsInline
            muted={storyVideoMuted}
            onTimeUpdate={onVideoTimeUpdate}
            onEnded={onVideoEnded}
            style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
          />
        ) : (
          <SharedPostStoryCard story={story} />
        )}

        {/* Progress segments — hidden entirely in memories mode */}
        {mode === 'stories' && (
          <div style={{ position: 'absolute', top: 14, left: 10, right: 10, display: 'flex', gap: 4, zIndex: 5 }}>
            {group.stories.map((s, i) => (
              <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.3)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%', background: '#fff', borderRadius: 999,
                    width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%',
                    transition: reducedMotion ? 'none' : 'width 0.1s linear',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div style={{ position: 'absolute', top: mode === 'stories' ? 26 : 14, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOrgGroup ? (
              group.user.avatar_url ? (
                <img src={group.user.avatar_url} alt={group.user.full_name || 'Organisation'} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏢</div>
              )
            ) : (
              <Avatar url={group.user.avatar_url} name={group.user.full_name} size={32} />
            )}
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                {isOrgGroup ? (group.user.full_name || 'Organisation') : (isOwner ? 'You' : displayName)}
                {isOrgGroup && <span style={{ fontSize: 10, fontWeight: 700, color: '#7dd3fc', background: 'rgba(56,189,248,.18)', padding: '1px 5px', borderRadius: 5 }}>ORG</span>}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)' }}>
                {isOrgGroup && story.posted_by_name ? `Posted by ${story.posted_by_name} · ` : ''}
                {relativeTime(story.created_at)}{mode === 'memories' ? ' · Memory' : ''}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, background: 'rgba(0,0,0,.3)', borderRadius: '50%' }}
          >
            ✕
          </button>
        </div>

        {/* Tap zones for next/prev + press-and-hold to pause */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 3 }}>
          <div
            style={{ flex: 1 }}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            onClick={(e) => { e.stopPropagation(); goPrevStory() }}
          />
          <div
            style={{ flex: 1 }}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            onClick={(e) => { e.stopPropagation(); goNextStory() }}
          />
        </div>

        {/* Caption */}
        {story.caption && (
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 92, zIndex: 5, fontSize: 14, color: '#fff', background: 'rgba(0,0,0,.35)', padding: '0.55rem 0.75rem', borderRadius: 12, backdropFilter: 'blur(4px)' }}>
            {story.caption}
          </div>
        )}

        {/* Owner controls */}
        {isOwner && mode === 'stories' && (
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 16, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button
              onClick={(e) => { e.stopPropagation(); openViewers() }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', background: 'rgba(0,0,0,.4)', padding: '0.4rem 0.65rem', borderRadius: 999 }}
            >
              👁 {story.view_count} view{story.view_count === 1 ? '' : 's'}
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              {!story.saved_as_memory && !isOrgGroup && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSaveAsMemory() }}
                  style={{ fontSize: 12, fontWeight: 700, padding: '0.4rem 0.65rem', borderRadius: 999, background: 'linear-gradient(135deg,var(--ft-accent),#00d4aa)', color: 'var(--ft-bg)' }}
                >
                  💾 Save as Memory
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setPaused(true); setDeleteConfirm(true) }}
                style={{ fontSize: 12, padding: '0.4rem 0.55rem', borderRadius: 999, background: 'rgba(255,77,109,.25)', color: '#ffb3c0' }}
                aria-label="Delete story"
              >
                🗑
              </button>
            </div>
          </div>
        )}

        {/* Owner delete confirm (memories mode) */}
        {isOwner && mode === 'memories' && (
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 16, zIndex: 6, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setPaused(true); setDeleteConfirm(true) }}
              style={{ fontSize: 12, padding: '0.4rem 0.65rem', borderRadius: 999, background: 'rgba(255,77,109,.25)', color: '#ffb3c0' }}
            >
              🗑 Delete Memory
            </button>
          </div>
        )}

        {/* Delete confirm dialog */}
        {deleteConfirm && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--ft-surface)', border: '1px solid var(--ft-surface)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 320 }}>
              <div style={{ fontWeight: 700, color: 'var(--ft-text)', marginBottom: 6 }}>
                {mode === 'memories' ? 'Delete this memory?' : 'Delete this story?'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ft-text-tertiary)', marginBottom: 16 }}>This can't be undone.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setDeleteConfirm(false); setPaused(false) }} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, background: 'var(--ft-bg)', color: 'var(--ft-text)', fontWeight: 600 }}>Cancel</button>
                <button onClick={mode === 'memories' ? async () => {
                  if (!story) return
                  try {
                    const res = await fetch(`/api/memories/${story.id}`, { method: 'DELETE' })
                    if (res.ok) { onStoryChanged?.(); goNextStory() } else showToast('Could not delete — try again')
                  } catch { showToast('Network error — try again') }
                  setDeleteConfirm(false)
                } : handleDelete} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, background: '#ff4d6d', color: '#fff', fontWeight: 700 }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Viewers sheet */}
        {viewersOpen && (
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 30, display: 'flex', alignItems: 'flex-end' }}
            onClick={() => { setViewersOpen(false); setPaused(false) }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxHeight: '60%', overflowY: 'auto', background: 'var(--ft-surface)', borderRadius: '20px 20px 0 0', padding: '1rem 1.1rem 1.5rem' }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--ft-text-faint)', margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: 700, color: 'var(--ft-text)', marginBottom: 12 }}>Viewers ({viewers.length})</div>
              {viewersLoading ? (
                <div style={{ color: 'var(--ft-text-tertiary)', fontSize: 13 }}>Loading…</div>
              ) : viewers.length === 0 ? (
                <div style={{ color: 'var(--ft-text-tertiary)', fontSize: 13 }}>No views yet.</div>
              ) : (
                viewers.map(v => (
                  <div key={v.viewer_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0' }}>
                    <Avatar url={v.profiles?.avatar_url} name={v.profiles?.full_name} size={32} />
                    <div style={{ fontSize: 13, color: 'var(--ft-text)', fontWeight: 600 }}>{v.profiles?.full_name || 'FreeTrust member'}</div>
                    <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ft-text-faint)' }}>{relativeTime(v.viewed_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,214,160,.16)', border: '1px solid rgba(6,214,160,.4)', color: '#06d6a0', fontSize: 13, fontWeight: 600, padding: '0.5rem 0.9rem', borderRadius: 999, zIndex: 40 }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
