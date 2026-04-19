'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['General', 'Services', 'Products', 'Events', 'Jobs', 'Group', 'Article']

interface CreateMenuProps {
  /** When true the trigger renders as the big center pill for mobile bottom nav */
  asCenterButton?: boolean
  onClose?: () => void
}

export default function CreateMenu({ asCenterButton = false, onClose }: CreateMenuProps) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [open, setOpen] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [postCategory, setPostCategory] = useState('General')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const closeAll = useCallback(() => {
    setOpen(false)
    setShowPostForm(false)
    setPostContent('')
    setPostCategory('General')
    setError('')
    setSuccess(false)
    onClose?.()
  }, [onClose])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeAll()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closeAll])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, closeAll])

  const navigate = (href: string) => {
    closeAll()
    router.push(href)
  }

  const handlePost = async () => {
    if (!postContent.trim()) { setError('Write something first.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/feed/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: postContent.trim(), category: postCategory }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to post')
      } else {
        setSuccess(true)
        setTimeout(closeAll, 1000)
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const triggerStyle: React.CSSProperties = asCenterButton
    ? {
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '26px',
        color: '#fff',
        boxShadow: '0 4px 20px rgba(56,189,248,0.4)',
        transform: 'translateY(-6px)',
        flexShrink: 0,
      }
    : {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '18px',
        color: '#fff',
        flexShrink: 0,
      }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Trigger */}
      <button
        aria-label="Create"
        onClick={() => setOpen(v => !v)}
        style={triggerStyle}
      >
        {open ? '✕' : '+'}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          ...(asCenterButton
            ? { bottom: '62px', left: '50%', transform: 'translateX(-50%)' }
            : { top: '42px', right: 0 }),
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          minWidth: '240px',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.2px' }}>
              Create something
            </span>
          </div>

          {!showPostForm ? (
            <div style={{ padding: '8px' }}>
              {/* Quick Post */}
              <button
                onClick={() => setShowPostForm(true)}
                style={menuItemStyle}
              >
                <span style={{ fontSize: '18px' }}>📝</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>Post</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Share a quick update</div>
                </div>
              </button>

              {/* Job */}
              <button onClick={() => navigate('/jobs/new')} style={menuItemStyle}>
                <span style={{ fontSize: '18px' }}>💼</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>Job</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Post a job listing</div>
                </div>
              </button>

              {/* Event */}
              <button onClick={() => navigate('/events/create')} style={menuItemStyle}>
                <span style={{ fontSize: '18px' }}>📅</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>Event</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Create an event</div>
                </div>
              </button>

              {/* Article */}
              <button onClick={() => navigate('/articles/new')} style={menuItemStyle}>
                <span style={{ fontSize: '18px' }}>✍️</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>Article</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Write a long-form piece</div>
                </div>
              </button>
            </div>
          ) : (
            <div style={{ padding: '12px' }}>
              {/* Post Form */}
              <textarea
                autoFocus
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  color: '#f1f5f9',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <select
                  value={postCategory}
                  onChange={e => setPostCategory(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '12px',
                    color: '#94a3b8',
                    outline: 'none',
                  }}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={() => setShowPostForm(false)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid #334155',
                    color: '#64748b',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handlePost}
                  disabled={submitting || success}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: success ? '#22c55e' : 'linear-gradient(135deg, #38bdf8, #818cf8)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {success ? '✓ Posted!' : submitting ? '…' : 'Post'}
                </button>
              </div>
              {error && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#f87171' }}>{error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  padding: '10px 10px',
  borderRadius: '8px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s',
}
