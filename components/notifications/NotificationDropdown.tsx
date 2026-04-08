'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotificationItem from './NotificationItem'
import type { DBNotification } from './NotificationBell'

const TYPE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Messages', value: 'message' },
  { label: 'Orders', value: 'order' },
  { label: 'Trust', value: 'trust' },
  { label: 'Reviews', value: 'review' },
  { label: 'Likes', value: 'gig_liked' },
]

interface Props {
  notifications: DBNotification[]
  loading: boolean
  onClose: () => void
  onMarkAllRead: () => void
  onMarkOneRead: (id: string) => void
  onDelete: (id: string) => void
}

export default function NotificationDropdown({
  notifications,
  loading,
  onClose,
  onMarkAllRead,
  onMarkOneRead,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter)

  const hasUnread = filtered.some(n => !n.read)

  return (
    <>
      <style>{`
        .notif-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 360px;
          background: #1e293b;
          border: 1px solid rgba(56,189,248,0.15);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          z-index: 2000;
          overflow: hidden;
        }
        @media (max-width: 480px) {
          .notif-dropdown {
            position: fixed;
            top: 58px;
            left: 0;
            right: 0;
            width: 100%;
            border-radius: 0;
            border-left: none;
            border-right: none;
          }
        }
        .notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.1rem 0.65rem;
          border-bottom: 1px solid rgba(56,189,248,0.08);
        }
        .notif-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #f1f5f9;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .notif-badge {
          background: rgba(56,189,248,0.15);
          color: #38bdf8;
          border-radius: 999px;
          padding: 0.1rem 0.4rem;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .notif-mark-all {
          background: none;
          border: none;
          cursor: pointer;
          color: #38bdf8;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          border-radius: 5px;
          transition: background 0.15s;
        }
        .notif-mark-all:hover { background: rgba(56,189,248,0.1); }
        .notif-filters {
          display: flex;
          gap: 0.25rem;
          padding: 0.55rem 0.9rem;
          border-bottom: 1px solid rgba(56,189,248,0.08);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .notif-filters::-webkit-scrollbar { display: none; }
        .notif-filter-btn {
          background: none;
          border: 1px solid transparent;
          cursor: pointer;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.22rem 0.6rem;
          border-radius: 999px;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .notif-filter-btn:hover { color: #94a3b8; border-color: rgba(148,163,184,0.2); }
        .notif-filter-btn.active {
          color: #38bdf8;
          background: rgba(56,189,248,0.1);
          border-color: rgba(56,189,248,0.3);
        }
        .notif-list {
          max-height: 340px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(56,189,248,0.2) transparent;
        }
        .notif-list::-webkit-scrollbar { width: 4px; }
        .notif-list::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 2px; }
        .notif-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1rem;
          gap: 0.5rem;
          color: #64748b;
          font-size: 0.85rem;
          text-align: center;
        }
        .notif-empty-icon { font-size: 2rem; margin-bottom: 0.25rem; }
        .notif-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1rem;
          color: #64748b;
          font-size: 0.85rem;
        }
        .notif-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 1.1rem;
          border-top: 1px solid rgba(56,189,248,0.08);
        }
        .notif-view-all {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #38bdf8;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .notif-view-all:hover { opacity: 0.75; }
        .notif-prefs-link {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.75rem;
          color: #64748b;
          text-decoration: none;
          transition: color 0.15s;
        }
        .notif-prefs-link:hover { color: #94a3b8; }
      `}</style>

      <div className="notif-dropdown" role="dialog" aria-label="Notifications">
        {/* Header */}
        <div className="notif-header">
          <div className="notif-title">
            Notifications
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="notif-badge">{notifications.filter(n => !n.read).length} new</span>
            )}
          </div>
          {hasUnread && (
            <button className="notif-mark-all" onClick={onMarkAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="notif-filters" role="tablist">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              className={`notif-filter-btn${filter === f.value ? ' active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="notif-list" role="list">
          {loading ? (
            <div className="notif-loading">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="notif-empty">
              <span className="notif-empty-icon">🔔</span>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>No notifications</span>
              <span>You&apos;re all caught up!</span>
            </div>
          ) : (
            filtered.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClose={onClose}
                onMarkRead={onMarkOneRead}
                onDelete={onDelete}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="notif-footer">
          <Link href="/notifications" className="notif-view-all" onClick={onClose}>
            View all
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link href="/notifications/preferences" className="notif-prefs-link" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
            Preferences
          </Link>
        </div>
      </div>
    </>
  )
}
