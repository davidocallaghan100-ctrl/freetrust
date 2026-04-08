'use client'

import Link from 'next/link'
import type { DBNotification } from './NotificationBell'

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
  return new Date(isoString).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
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

function getTypeColor(type: string): { bg: string; color: string } {
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

interface Props {
  notification: DBNotification
  onClose?: () => void
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}

export default function NotificationItem({ notification, onClose, onMarkRead, onDelete }: Props) {
  const { bg, color } = getTypeColor(notification.type)
  const icon = getTypeIcon(notification.type)

  const handleClick = () => {
    if (!notification.read) onMarkRead(notification.id)
    if (onClose) onClose()
  }

  const handleMarkRead = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMarkRead(notification.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(notification.id)
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem 1.1rem',
    borderLeft: notification.read ? '3px solid transparent' : '3px solid #38bdf8',
    background: notification.read ? 'transparent' : 'rgba(56,189,248,0.04)',
    borderBottom: '1px solid rgba(56,189,248,0.06)',
    transition: 'background 0.15s',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    textDecoration: 'none',
    color: 'inherit',
  }

  const content = (
    <div style={itemStyle as React.CSSProperties} role="listitem">
      {/* Icon circle */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
        flexShrink: 0,
        marginTop: 2,
      }}>
        {icon}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: '0.82rem',
          fontWeight: notification.read ? 500 : 700,
          color: notification.read ? '#94a3b8' : '#f1f5f9',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {notification.title}
        </p>
        <p style={{
          margin: '0.15rem 0 0',
          fontSize: '0.75rem',
          color: '#64748b',
          lineHeight: 1.45,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {notification.body}
        </p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#475569' }}>
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0, opacity: 0.7 }}>
        {!notification.read && (
          <button
            onClick={handleMarkRead}
            title="Mark as read"
            aria-label="Mark as read"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#38bdf8',
              padding: '0.2rem',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
        <button
          onClick={handleDelete}
          title="Remove"
          aria-label="Remove notification"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
            padding: '0.2rem',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )

  if (notification.link) {
    return (
      <Link href={notification.link} style={{ textDecoration: 'none', display: 'block' }} onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return (
    <button style={{ background: 'none', border: 'none', display: 'block', width: '100%', padding: 0 }} onClick={handleClick}>
      {content}
    </button>
  )
}
