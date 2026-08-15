'use client'

import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/Avatar'
import StoryViewer from '@/components/stories/StoryViewer'
import StoryCreateSheet from '@/components/stories/StoryCreateSheet'
import type { StoryAuthorGroup } from '@/types/stories'

export interface StoriesBarProps {
  currentUserId?: string
}

// Horizontal scrollable row of circular story bubbles at the top of the feed.
// Own bubble (with a "+" add badge) always renders first, followed by
// connections' groups sorted unviewed-first then most-recent-first (the
// ordering itself comes pre-sorted from GET /api/stories). Bubbles get a
// gradient ring when they contain at least one unviewed story, and a plain
// grey ring once everything in the group has been viewed.
export default function StoriesBar({ currentUserId }: StoriesBarProps) {
  const [groups, setGroups] = useState<StoryAuthorGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stories', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { groups: StoryAuthorGroup[] }
        setGroups(data.groups ?? [])
      }
    } catch { /* silent — stories bar is progressive enhancement */ }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (!currentUserId) return null // signed-out visitors don't see a Stories bar

  const ownGroup = groups.find(g => g.user.id === currentUserId)
  const otherGroups = groups.filter(g => g.user.id !== currentUserId)

  const handleOwnBubbleClick = () => {
    if (ownGroup) {
      setViewerGroupIndex(groups.findIndex(g => g.user.id === currentUserId))
    } else {
      setCreateOpen(true)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 14, padding: '0.9rem 0.25rem', marginBottom: '0.85rem', overflow: 'hidden' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--ft-surface)' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: 'var(--ft-surface)' }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        className="stories-bar-scroll"
        style={{ display: 'flex', gap: 14, padding: '0.9rem 0.25rem', marginBottom: '0.85rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        <style>{`.stories-bar-scroll::-webkit-scrollbar { display: none; }`}</style>

        {/* Own bubble — always first */}
        <button
          onClick={handleOwnBubbleClick}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: 64 }}
        >
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%', padding: 2.5,
              background: ownGroup?.hasUnviewed
                ? 'linear-gradient(135deg,var(--ft-accent),#00d4aa)'
                : ownGroup
                  ? 'var(--ft-text-faint)'
                  : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}
          >
            <div style={{ background: 'var(--ft-bg)', borderRadius: '50%', padding: 2 }}>
              <Avatar url={ownGroup?.user.avatar_url} name={ownGroup?.user.full_name} size={54} />
            </div>
            <div
              style={{
                position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
                background: 'linear-gradient(135deg,var(--ft-accent),#00d4aa)', color: 'var(--ft-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                border: '2px solid var(--ft-bg)',
              }}
              onClick={(e) => { e.stopPropagation(); setCreateOpen(true) }}
              aria-label="Add to your story"
            >
              +
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--ft-text-tertiary)', fontWeight: 600, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Your Story
          </span>
        </button>

        {/* Connections' bubbles */}
        {otherGroups.map((group) => {
          const displayName = group.user.full_name || 'FreeTrust member'
          return (
            <button
              key={group.user.id}
              onClick={() => setViewerGroupIndex(groups.findIndex(g => g.user.id === group.user.id))}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: 64 }}
            >
              <div
                style={{
                  width: 64, height: 64, borderRadius: '50%', padding: 2.5,
                  background: group.hasUnviewed ? 'linear-gradient(135deg,var(--ft-accent),#00d4aa)' : 'var(--ft-text-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div style={{ background: 'var(--ft-bg)', borderRadius: '50%', padding: 2 }}>
                  <Avatar url={group.user.avatar_url} name={group.user.full_name} size={54} />
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ft-text-tertiary)', fontWeight: group.hasUnviewed ? 700 : 500, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName.split(' ')[0]}
              </span>
            </button>
          )
        })}
      </div>

      {viewerGroupIndex !== null && currentUserId && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewerGroupIndex}
          currentUserId={currentUserId}
          mode="stories"
          onClose={() => { setViewerGroupIndex(null); void load() }}
          onStoryChanged={() => void load()}
        />
      )}

      {createOpen && (
        <StoryCreateSheet
          onClose={() => setCreateOpen(false)}
          onShared={() => void load()}
        />
      )}
    </>
  )
}
