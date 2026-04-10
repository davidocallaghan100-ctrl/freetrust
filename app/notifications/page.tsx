'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────────

type DBType = 'message' | 'order' | 'trust' | 'review' | 'gig_liked' | 'system'
type TabKey = 'all' | 'orders' | 'payments' | 'messages' | 'reviews' | 'community' | 'system'

interface DBNotification {
  id: string
  type: DBType
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

interface Prefs {
  messages: boolean
  orders: boolean
  trust: boolean
  reviews: boolean
  gig_liked: boolean
  system: boolean
  email_digest: boolean
}

// ── Mappings ───────────────────────────────────────────────────────────────────

const TYPE_TO_TAB: Record<DBType, TabKey> = {
  order:     'orders',
  trust:     'payments',
  message:   'messages',
  review:    'reviews',
  gig_liked: 'community',
  system:    'system',
}

const TYPE_ICON: Record<DBType, string> = {
  message:   '💬',
  order:     '📦',
  trust:     '₮',
  review:    '⭐',
  gig_liked: '❤️',
  system:    '🔔',
}

const TYPE_COLOR: Record<DBType, { bg: string; color: string }> = {
  message:   { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
  order:     { bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
  trust:     { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  review:    { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  gig_liked: { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  system:    { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'orders',    label: 'Orders' },
  { key: 'payments',  label: 'Payments' },
  { key: 'messages',  label: 'Messages' },
  { key: 'reviews',   label: 'Reviews' },
  { key: 'community', label: 'Community' },
  { key: 'system',    label: 'System' },
]

const DEFAULT_PREFS: Prefs = {
  messages:    true,
  orders:      true,
  trust:       true,
  reviews:     true,
  gig_liked:   true,
  system:      true,
  email_digest: false,
}

const PREF_ROWS: { key: keyof Prefs; label: string; desc: string; icon: string }[] = [
  { key: 'messages',    label: 'Messages',      desc: 'New messages from buyers/sellers',  icon: '💬' },
  { key: 'orders',      label: 'Orders',         desc: 'Dispatch, delivery, disputes',      icon: '📦' },
  { key: 'trust',       label: 'Trust Tokens',   desc: 'Earned trust token notifications',  icon: '₮'  },
  { key: 'reviews',     label: 'Reviews',        desc: 'New ratings on your services',      icon: '⭐' },
  { key: 'gig_liked',   label: 'Gig Likes',      desc: 'When someone likes your listing',   icon: '❤️' },
  { key: 'system',      label: 'System Alerts',  desc: 'Badges and platform notices',       icon: '🔔' },
  { key: 'email_digest',label: 'Email Digest',   desc: 'Daily summary to your inbox',       icon: '📧' },
]

// ── Helper ─────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (s < 60)  return 'just now'
  if (m < 60)  return `${m}m ago`
  if (h < 24)  return `${h}h ago`
  if (d < 7)   return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter()

  const [authed,       setAuthed]       = useState<boolean | null>(null)
  const [notifications, setNotifications] = useState<DBNotification[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState<TabKey>('all')
  const [showPrefs,    setShowPrefs]    = useState(false)
  const [prefs,        setPrefs]        = useState<Prefs>(DEFAULT_PREFS)
  const [prefsSaving,  setPrefsSaving]  = useState(false)
  const [prefsSaved,   setPrefsSaved]   = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Auth check ───────────────────────────────────────────────────────────────

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

  // ── Data fetching ────────────────────────────────────────────────────────────

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=100')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      }
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences')
      if (res.ok) {
        const data = await res.json()
        if (data.preferences) {
          setPrefs({
            messages:     data.preferences.messages    ?? true,
            orders:       data.preferences.orders      ?? true,
            trust:        data.preferences.trust       ?? true,
            reviews:      data.preferences.reviews     ?? true,
            gig_liked:    data.preferences.gig_liked   ?? true,
            system:       data.preferences.system      ?? true,
            email_digest: data.preferences.email_digest ?? false,
          })
        }
      }
    } catch { /* use defaults */ }
  }, [])

  useEffect(() => {
    if (!authed) return
    void Promise.all([loadNotifications(), loadPrefs()])
  }, [authed, loadNotifications, loadPrefs])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const markRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    } catch { /* silent */ }
  }

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
    } catch { /* silent */ }
    showToast('All notifications marked as read')
  }

  const deleteNotif = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    } catch { /* silent */ }
  }

  const clearRead = async () => {
    const readIds = notifications.filter(n => n.read).map(n => n.id)
    if (readIds.length === 0) {
      showToast('No read notifications to clear')
      return
    }
    setNotifications(prev => prev.filter(n => !n.read))
    try {
      await Promise.all(readIds.map(id => fetch(`/api/notifications/${id}`, { method: 'DELETE' })))
    } catch { /* silent */ }
    showToast(`Cleared ${readIds.length} read notification${readIds.length === 1 ? '' : 's'}`)
  }

  const savePrefs = async () => {
    setPrefsSaving(true)
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 2500)
    } catch { /* silent */ } finally {
      setPrefsSaving(false)
    }
  }

  const togglePref = (key: keyof Prefs) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
    setPrefsSaved(false)
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const unreadCount = notifications.filter(n => !n.read).length

  const filtered = notifications.filter(n =>
    activeTab === 'all' ? true : TYPE_TO_TAB[n.type] === activeTab
  )

  const tabUnread = (key: TabKey) =>
    key === 'all'
      ? unreadCount
      : notifications.filter(n => TYPE_TO_TAB[n.type] === key && !n.read).length

  // ── Render ────────────────────────────────────────────────────────────────────

  if (authed === null) return null

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes np-fadein { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        .np-tabs::-webkit-scrollbar { display:none }
        .np-notif { position:relative; display:flex; align-items:flex-start; gap:0.85rem; padding:1rem 1.1rem; border-left:3px solid transparent; border-bottom:1px solid rgba(56,189,248,0.06); transition:background 0.15s; width:100%; text-align:left; box-sizing:border-box; text-decoration:none; color:inherit; }
        .np-notif.unread { border-left-color:#38bdf8; background:rgba(56,189,248,0.04); }
        .np-notif:hover { background:rgba(56,189,248,0.07); }
        .np-notif:last-child { border-bottom:none; }
        .np-act-btn { background:none; border:none; cursor:pointer; border-radius:5px; padding:0.25rem; display:flex; align-items:center; justify-content:center; transition:background 0.12s, color 0.12s; }
        .np-act-btn:hover { background:rgba(56,189,248,0.12); }
        .np-del-btn:hover { background:rgba(239,68,68,0.12) !important; color:#f87171 !important; }
        .np-pref-toggle { position:relative; width:44px; height:24px; flex-shrink:0; }
        .np-pref-toggle input { opacity:0; width:0; height:0; position:absolute; }
        .np-pref-track { position:absolute; inset:0; border-radius:12px; background:#334155; transition:background 0.2s; cursor:pointer; }
        .np-pref-toggle input:checked + .np-pref-track { background:#38bdf8; }
        .np-pref-thumb { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform 0.2s; pointer-events:none; }
        .np-pref-toggle input:checked ~ .np-pref-thumb { transform:translateX(20px); }
        .np-hdr-btn { display:flex; align-items:center; gap:0.4rem; padding:0.4rem 0.8rem; border-radius:8px; border:1px solid rgba(56,189,248,0.15); background:transparent; color:#94a3b8; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s; font-family:inherit; white-space:nowrap; }
        .np-hdr-btn:hover { border-color:rgba(56,189,248,0.4); color:#38bdf8; background:rgba(56,189,248,0.06); }
        .np-hdr-btn.active { background:rgba(56,189,248,0.12); border-color:#38bdf8; color:#38bdf8; }
        .np-hdr-btn.danger:hover { border-color:rgba(239,68,68,0.35); color:#f87171; background:rgba(239,68,68,0.06); }
        .np-tab { flex-shrink:0; display:flex; align-items:center; gap:0.3rem; padding:0.4rem 0.8rem; border-radius:999px; border:1px solid rgba(56,189,248,0.12); background:transparent; color:#64748b; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s; font-family:inherit; }
        .np-tab:hover { border-color:rgba(56,189,248,0.3); color:#94a3b8; }
        .np-tab.active { background:rgba(56,189,248,0.15); border-color:#38bdf8; color:#38bdf8; }
        .np-badge { display:inline-flex; align-items:center; justify-content:center; min-width:17px; height:17px; border-radius:999px; padding:0 4px; font-size:0.65rem; font-weight:700; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10, padding: '10px 18px', fontSize: 13, color: '#f1f5f9', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', animation: 'np-fadein 0.2s ease' }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1rem' }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.5rem 0 1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Title + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🔔</span>
              {unreadCount > 0 && (
                <span
                  className="np-badge"
                  style={{ position: 'absolute', top: -6, right: -8, background: '#ef4444', color: '#fff' }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Notifications</h1>
              <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '2px 0 0' }}>
                {loading
                  ? 'Loading…'
                  : unreadCount > 0
                    ? `${unreadCount} unread`
                    : 'You\'re all caught up'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {unreadCount > 0 && (
              <button className="np-hdr-btn" onClick={markAllRead} title="Mark all notifications as read">
                {/* checkmark */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Mark all read
              </button>
            )}
            <button className="np-hdr-btn danger" onClick={clearRead} title="Delete all read notifications">
              {/* trash */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
              Clear read
            </button>
            <button
              className={`np-hdr-btn${showPrefs ? ' active' : ''}`}
              onClick={() => setShowPrefs(v => !v)}
              title="Toggle notification preferences"
            >
              {/* cog */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Preferences
            </button>
          </div>
        </div>

        {/* ── Preferences panel ────────────────────────────────────────────────── */}
        {showPrefs && (
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', animation: 'np-fadein 0.18s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
                Notification Preferences
              </h2>
              <Link
                href="/notifications/preferences"
                style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}
              >
                Full settings →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0 1.5rem' }}>
              {PREF_ROWS.map(({ key, label, desc, icon }) => (
                <div
                  key={key}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0', borderBottom: '1px solid rgba(56,189,248,0.06)' }}
                >
                  <span style={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
                  </div>
                  <label className="np-pref-toggle" aria-label={`Toggle ${label}`}>
                    <input
                      type="checkbox"
                      checked={prefs[key]}
                      onChange={() => togglePref(key)}
                    />
                    <span className="np-pref-track" />
                    <span className="np-pref-thumb" />
                  </label>
                </div>
              ))}
            </div>

            <button
              onClick={savePrefs}
              disabled={prefsSaving}
              style={{
                marginTop: '1rem',
                width: '100%',
                padding: '0.65rem',
                background: prefsSaved ? '#16a34a' : '#38bdf8',
                color: prefsSaved ? '#dcfce7' : '#0f172a',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: prefsSaving ? 'not-allowed' : 'pointer',
                opacity: prefsSaving ? 0.7 : 1,
                transition: 'background 0.2s, color 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {prefsSaved ? '✓ Saved!' : prefsSaving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        )}

        {/* ── Filter tabs ───────────────────────────────────────────────────────── */}
        <div
          className="np-tabs"
          style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '0.25rem', marginBottom: '1rem' }}
        >
          {TABS.map(tab => {
            const count = tabUnread(tab.key)
            return (
              <button
                key={tab.key}
                className={`np-tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className="np-badge"
                    style={{
                      background: activeTab === tab.key ? '#38bdf8' : 'rgba(56,189,248,0.15)',
                      color:      activeTab === tab.key ? '#0f172a' : '#38bdf8',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Notifications list ────────────────────────────────────────────────── */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            /* Skeleton */
            <div>
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.1rem', borderBottom: '1px solid rgba(56,189,248,0.06)' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(90deg,#243047 25%,#2d3f55 50%,#243047 75%)', backgroundSize: '200%', animation: 'shimmer 1.5s infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: '50%', background: 'linear-gradient(90deg,#243047 25%,#2d3f55 50%,#243047 75%)', backgroundSize: '200%', animation: 'shimmer 1.5s infinite', borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 11, width: '80%', background: 'linear-gradient(90deg,#243047 25%,#2d3f55 50%,#243047 75%)', backgroundSize: '200%', animation: 'shimmer 1.5s infinite', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔔</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8' }}>No notifications here</div>
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.35rem' }}>
                You&apos;re all caught up{activeTab !== 'all' ? ' in this category' : ''}.
              </div>
            </div>
          ) : (
            /* Notification rows */
            filtered.map(n => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={markRead}
                onDelete={deleteNotif}
              />
            ))
          )}
        </div>

        {/* Footer count */}
        {!loading && notifications.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#334155', margin: '0.85rem 0 0' }}>
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Notification row ───────────────────────────────────────────────────────────

function NotificationRow({
  notification: n,
  onMarkRead,
  onDelete,
}: {
  notification: DBNotification
  onMarkRead: (id: string) => void
  onDelete:   (id: string) => void
}) {
  const { bg, color } = TYPE_COLOR[n.type] ?? TYPE_COLOR.system
  const icon           = TYPE_ICON[n.type]  ?? '🔔'

  const handleWrapperClick = () => { if (!n.read) onMarkRead(n.id) }
  const handleMarkRead = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onMarkRead(n.id) }
  const handleDelete   = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onDelete(n.id) }

  const body = (
    <div className={`np-notif${n.read ? '' : ' unread'}`} onClick={handleWrapperClick}>
      {/* Type icon */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1rem', flexShrink: 0, marginTop: 2,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '0.85rem',
          fontWeight: n.read ? 500 : 700,
          color: n.read ? '#94a3b8' : '#f1f5f9',
          lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {n.title}
        </p>
        <p style={{
          margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {n.body}
        </p>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.7rem', color: '#475569' }}>
          {relativeTime(n.created_at)}
        </p>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
        {!n.read && (
          <button
            className="np-act-btn"
            onClick={handleMarkRead}
            title="Mark as read"
            aria-label="Mark as read"
            style={{ color: '#38bdf8' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        )}
        <button
          className="np-act-btn np-del-btn"
          onClick={handleDelete}
          title="Remove notification"
          aria-label="Remove notification"
          style={{ color: '#475569' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )

  // Wrap in a Link when the notification carries a target URL
  if (n.link) {
    return (
      <Link href={n.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} onClick={handleWrapperClick}>
        {body}
      </Link>
    )
  }

  return body
}
