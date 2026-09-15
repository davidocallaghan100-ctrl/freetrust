'use client'

import Link from 'next/link'
import { useUnreadCount } from '@/hooks/useUnreadCount'

// Header message icon + unread badge, styled to match
// components/notifications/NotificationBell.tsx so the two sit
// consistently side-by-side in the top nav. Unlike the notification
// bell this has no dropdown — it's a direct link to /messages, which
// already has its own inbox UI (conversation list + thread).
export default function MessagesBell() {
  const { unreadCount } = useUnreadCount()

  return (
    <Link
      href="/messages"
      aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 6,
        background: 'transparent',
        border: '1px solid rgba(148,163,184,0.2)',
        cursor: 'pointer',
        color: 'var(--ft-text-secondary)',
        position: 'relative',
        transition: 'all 0.15s',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <svg
        width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>

      {unreadCount > 0 && (
        <span
          aria-label={`${unreadCount} unread messages`}
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#ef4444',
            borderRadius: '50%',
            minWidth: 16,
            height: 16,
            fontSize: '0.6rem',
            fontWeight: 700,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            border: '2px solid rgba(15,23,42,0.97)',
            lineHeight: 1,
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
