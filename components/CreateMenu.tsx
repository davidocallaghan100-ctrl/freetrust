'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['General', 'Services', 'Products', 'Events', 'Jobs', 'Group', 'Article']

interface CreateMenuProps {
  /** When true the trigger renders as the big center pill for mobile bottom nav */
  asCenterButton?: boolean
  onClose?: () => void
}

export default function CreateMenu({ asCenterButton = false, onClose }: CreateMenuProps) {
  const router = useRouter()
  const t = useTranslations('createMenu')
  const tCommon = useTranslations('common')
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
    if (!postContent.trim()) { setError(t('errors.writeSomething')); return }
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
        setError(data.error ?? t('errors.failedToPost'))
      } else {
        setSuccess(true)
        setTimeout(closeAll, 1000)
      }
    } catch {
      setError(t('errors.network'))
    } finally {
      setSubmitting(false)
    }
  }

  const triggerStyle: React.CSSProperties = asCenterButton
    ? {
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--ft-accent), #818cf8)',
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
        background: 'linear-gradient(135deg, var(--ft-accent), #818cf8)',
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
        aria-label={t('aria.create')}
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
          background: 'var(--ft-surface)',
          border: '1px solid var(--ft-border-strong)',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          minWidth: '240px',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ft-border-strong)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ft-text)', letterSpacing: '-0.2px' }}>
              {t('title')}
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
                   <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ft-text)' }}>{t('items.post.title')}</div>
                   <div style={{ fontSize: '11px', color: 'var(--ft-text-tertiary)' }}>{t('items.post.subtitle')}</div>
                </div>
              </button>

              {/* Job */}
              <button onClick={() => navigate('/jobs/new')} style={menuItemStyle}>
                <span style={{ fontSize: '18px' }}>💼</span>
                <div>
                   <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ft-text)' }}>{t('items.job.title')}</div>
                   <div style={{ fontSize: '11px', color: 'var(--ft-text-tertiary)' }}>{t('items.job.subtitle')}</div>
                </div>
              </button>

              {/* Event */}
              <button onClick={() => navigate('/events/create')} style={menuItemStyle}>
                <span style={{ fontSize: '18px' }}>📅</span>
                <div>
                   <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ft-text)' }}>{t('items.event.title')}</div>
                   <div style={{ fontSize: '11px', color: 'var(--ft-text-tertiary)' }}>{t('items.event.subtitle')}</div>
                </div>
              </button>

              {/* Article */}
              <button onClick={() => navigate('/articles/new')} style={menuItemStyle}>
                <span style={{ fontSize: '18px' }}>✍️</span>
                <div>
                   <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ft-text)' }}>{t('items.article.title')}</div>
                   <div style={{ fontSize: '11px', color: 'var(--ft-text-tertiary)' }}>{t('items.article.subtitle')}</div>
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
                placeholder={t('post.placeholder')}
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--ft-bg)',
                  border: '1px solid var(--ft-border-strong)',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  color: 'var(--ft-text)',
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
                    background: 'var(--ft-bg)',
                    border: '1px solid var(--ft-border-strong)',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '12px',
                    color: 'var(--ft-text-secondary)',
                    outline: 'none',
                  }}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
                </select>
                <button
                  onClick={() => setShowPostForm(false)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid var(--ft-border-strong)',
                    color: 'var(--ft-text-tertiary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {tCommon('back')}
                </button>
                <button
                  onClick={handlePost}
                  disabled={submitting || success}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: success ? '#22c55e' : 'linear-gradient(135deg, var(--ft-accent), #818cf8)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {success ? t('post.posted') : submitting ? '…' : t('post.submit')}
                </button>
              </div>
              {error && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--ft-danger)' }}>{error}</div>
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
