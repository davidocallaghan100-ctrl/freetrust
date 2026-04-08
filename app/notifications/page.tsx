'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DBNotification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(isoString).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'message': return '💬'
    case 'order': return '📦'
    case 'trust': return '₮'
    case 'review': return '⭐'
    case 'gig_liked': return '❤️'
    case 'system': return '🔔'
    default: return '🔔'
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'message': return 'Message'
    case 'order': return 'Order'
    case 'trust': return 'Trust'
    case 'review': return 'Review'
    case 'gig_liked': return 'Like'
    case 'system': return 'System'
    default: return 'Notification'
  }
}

function getTypeColors(type: string): { bg: string; color: string } {
  switch (type) {
    case 'message': return { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' }
    case 'order': return { bg: 'rgba(16,185,129,0.15)', color: '#34d399' }
    case 'trust': return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
    case 'review': return { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' }
    case 'gig_liked': return { bg: 'rgba(239,68,68,0.15)', color: '#f87171' }
    case 'system': return { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' }
    default: return { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' }
  }
}

const TABS = ['All', 'Unread', 'Messages', 'Orders', 'Trust', 'Reviews']

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<DBNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [markingAll, setMarkingAll] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login?redirect=/notifications')
      } else {
        setAuthed(true)
      }
    })
  }, [router])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=100')
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) fetchNotifications()
  }, [authed, fetchNotifications])

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } finally {
      setMarkingAll(false)
    }
  }

  const handleMarkOneRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const filtered = notifications.filter(n => {
    if (tab === 'Unread') return !n.read
    if (tab === 'Messages') return n.type === 'message'
    if (tab === 'Orders') return n.type === 'order'
    if (tab === 'Trust') return n.type === 'trust'
    if (tab === 'Reviews') return n.type === 'review'
    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length

  if (authed === null) return null

  return (
    <>
      <style>{`
        .notif-page { min-height: 100vh; background: #0f172a; padding: 2rem 1.25rem; }
        .notif-page-inner { max-width: 720px; margin: 0 auto; }
        .notif-page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
        .notif-page-title { font-size: 1.6rem; font-weight: 900; color: #f1f5f9; }
        .notif-page-actions { display: flex; gap: 0.75rem; align-items: center; }
        .notif-page-mark-all {
          padding: 0.45rem 1rem;
          background: rgba(56,189,248,0.12);
          color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .notif-page-mark-all:hover { background: rgba(56,189,248,0.2); }
        .notif-page-mark-all:disabled { opacity: 0.5; cursor: not-allowed; }
        .notif-page-prefs {
          padding: 0.45rem 1rem;
          background: transparent;
          color: #64748b;
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .notif-page-prefs:hover { color: #94a3b8; border-color: rgba(148,163,184,0.4); }
        .notif-tabs { display: flex; gap: 0.35rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .notif-tab-btn {
          padding: 0.4rem 1rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          background: none;
          color: #64748b;
          transition: all 0.15s;
        }
        .notif-tab-btn:hover { color: #94a3b8; border-color: rgba(148,163,184,0.2); }
        .notif-tab-btn.active {
          color: #38bdf8;
          background: rgba(56,189,248,0.1);
          border-color: rgba(56,189,248,0.3);
        }
        .notif-list-card {
          background: #1e293b;
          border: 1px solid rgba(56,189,248,0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .notif-row {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          padding: 1rem 1.1rem;
          border-left: 3px solid transparent;
          border-bottom: 1px solid rgba(56,189,248,0.06);
          transition: background 0.15s;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .notif-row:last-child { border-bottom: none; }
        .notif-row.unread { border-left-color: #38bdf8; background: rgba(56,189,248,0.03); }
        .notif-row:hover { background: rgba(56,189,248,0.06); }
        .notif-row-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .notif-row-body { flex: 1; min-width: 0; }
        .notif-row-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.15rem; }
        .notif-row-title { font-size: 0.88rem; font-weight: 700; color: #f1f5f9; }
        .notif-row-title.read { font-weight: 500; color: #94a3b8; }
        .notif-type-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .notif-row-body-text { font-size: 0.78rem; color: #64748b; line-height: 1.45; }
        .notif-row-time { font-size: 0.72rem; color: #475569; margin-top: 0.3rem; }
        .notif-row-actions { display: flex; gap: 0.25rem; flex-shrink: 0; margin-top: 2px; }
        .notif-action-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .notif-action-btn:hover { background: rgba(56,189,248,0.1); }
        .notif-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          gap: 0.65rem;
          text-align: center;
        }
        .notif-empty-icon { font-size: 3rem; }
        .notif-empty-title { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; }
        .notif-empty-sub { font-size: 0.85rem; color: #64748b; }
        @media (max-width: 600px) {
          .notif-page { padding: 1.25rem 1rem; }
          .notif-page-title { font-size: 1.3rem; }
          .notif-page-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <main className="notif-page">
        <div className="notif-page-inner">
          {/* Header */}
          <div className="notif-page-header">
            <div>
              <h1 className="notif-page-title">Notifications</h1>
              {unreadCount > 0 && (
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="notif-page-actions">
              {unreadCount > 0 && (
                <button
                  className="notif-page-mark-all"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                >
                  {markingAll ? 'Marking...' : 'Mark all read'}
                </button>
              )}
              <Link href="/notifications/preferences" className="notif-page-prefs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                Preferences
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="notif-tabs" role="tablist">
            {TABS.map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`notif-tab-btn${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
                {t === 'Unread' && unreadCount > 0 && (
                  <span style={{ marginLeft: '0.3rem', background: '#ef4444', color: '#fff', borderRadius: 999, padding: '0 4px', fontSize: '0.65rem', fontWeight: 700, verticalAlign: 'middle' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#64748b', border: '1px solid rgba(56,189,248,0.1)' }}>
              Loading notifications...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, border: '1px solid rgba(56,189,248,0.1)' }}>
              <div className="notif-empty-state">
                <span className="notif-empty-icon">🔔</span>
                <p className="notif-empty-title">No notifications</p>
                <p className="notif-empty-sub">
                  {tab === 'Unread' ? 'All caught up! No unread notifications.' : `No ${tab.toLowerCase()} notifications yet.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="notif-list-card" role="list">
              {filtered.map(notif => {
                const { bg, color } = getTypeColors(notif.type)
                const row = (
                  <div
                    className={`notif-row${!notif.read ? ' unread' : ''}`}
                    role="listitem"
                    key={notif.id}
                  >
                    <div className="notif-row-icon" style={{ background: bg, color }}>
                      {getTypeIcon(notif.type)}
                    </div>
                    <div className="notif-row-body">
                      <div className="notif-row-header">
                        <span className={`notif-row-title${notif.read ? ' read' : ''}`}>{notif.title}</span>
                        <span className="notif-type-badge" style={{ background: bg, color }}>{getTypeLabel(notif.type)}</span>
                      </div>
                      <p className="notif-row-body-text">{notif.body}</p>
                      <p className="notif-row-time">{formatRelativeTime(notif.created_at)}</p>
                    </div>
                    <div className="notif-row-actions">
                      {!notif.read && (
                        <button
                          className="notif-action-btn"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkOneRead(notif.id) }}
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                      )}
                      <button
                        className="notif-action-btn"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(notif.id) }}
                        title="Delete"
                        aria-label="Delete notification"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                )

                if (notif.link) {
                  return (
                    <Link
                      key={notif.id}
                      href={notif.link}
                      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                      onClick={() => { if (!notif.read) handleMarkOneRead(notif.id) }}
                    >
                      {row}
                    </Link>
                  )
                }
                return <div key={notif.id} style={{ display: 'block' }}>{row}</div>
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
