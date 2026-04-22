'use client'

import Link from 'next/link'

export interface ActivityItem {
  id: string
  type: 'job' | 'listing' | 'event' | 'article' | 'review'
  title: string
  subtitle?: string
  description?: string
  image_url?: string | null
  created_at: string
  link: string
  meta?: string
  status?: string
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30)  return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TYPE_META: Record<ActivityItem['type'], { icon: string; label: string; color: string; bg: string; border: string }> = {
  job:     { icon: '💼', label: 'Job',     color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)' },
  listing: { icon: '🛍',  label: 'Listing', color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.2)'  },
  event:   { icon: '📅', label: 'Event',   color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.2)'  },
  article: { icon: '📰', label: 'Article', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.2)'  },
  review:  { icon: '⭐', label: 'Review',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)'  },
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  draft:    { label: 'Draft',    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  closed:   { label: 'Closed',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  expired:  { label: 'Expired',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  inactive: { label: 'Inactive', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const tm   = TYPE_META[item.type] ?? TYPE_META.listing
  const stat = item.status ? STATUS_BADGE[item.status] : null

  return (
    <Link
      href={item.link}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.85rem',
        padding: '0.9rem 1rem',
        borderRadius: 12,
        border: '1px solid rgba(148,163,184,0.1)',
        background: 'rgba(15,23,42,0.5)',
        textDecoration: 'none',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.borderColor = tm.border
        el.style.background  = tm.bg
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.borderColor = 'rgba(148,163,184,0.1)'
        el.style.background  = 'rgba(15,23,42,0.5)'
      }}
    >
      {/* Image or type icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: tm.bg, border: `1px solid ${tm.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.image_url ? (
          <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1.3rem' }}>{tm.icon}</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.title}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '0.1rem' }}>
            {timeAgo(item.created_at)}
          </span>
        </div>

        {/* Type badge + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: tm.color,
            background: tm.bg, border: `1px solid ${tm.border}`,
            borderRadius: 20, padding: '1px 7px', letterSpacing: '0.04em',
          }}>
            {tm.icon} {tm.label}
          </span>
          {stat && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, color: stat.color,
              background: stat.bg, borderRadius: 20, padding: '1px 7px',
            }}>
              {stat.label}
            </span>
          )}
          {item.subtitle && (
            <span style={{ fontSize: '0.73rem', color: '#64748b' }}>{item.subtitle}</span>
          )}
        </div>

        {/* Description snippet */}
        {item.description && (
          <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, margin: '0.35rem 0 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.description}
          </p>
        )}

        {/* Meta */}
        {item.meta && (
          <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.3rem' }}>{item.meta}</div>
        )}
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div style={{ display: 'flex', gap: '0.85rem', padding: '0.9rem 1rem', borderRadius: 12, border: '1px solid rgba(148,163,184,0.08)', background: 'rgba(15,23,42,0.3)', animation: 'pulse 1.5s infinite' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1e293b', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, background: '#1e293b', borderRadius: 6, marginBottom: 8, width: '70%' }} />
        <div style={{ height: 10, background: '#1e293b', borderRadius: 6, width: '40%' }} />
      </div>
    </div>
  )
}

interface ActivityFeedProps {
  items?: ActivityItem[]
  loading?: boolean
  emptyTitle?: string
  emptySubtitle?: string
  emptyCtaHref?: string
  emptyCtaLabel?: string
}

export default function ActivityFeed({
  items = [],
  loading = false,
  emptyTitle = 'Nothing posted yet',
  emptySubtitle = 'Activity will appear here as jobs, events, services and more are created.',
  emptyCtaHref,
  emptyCtaLabel,
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.4rem' }}>{emptyTitle}</div>
        <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>{emptySubtitle}</div>
        {emptyCtaHref && emptyCtaLabel && (
          <Link
            href={emptyCtaHref}
            style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8, padding: '0.45rem 1rem', textDecoration: 'none' }}
          >
            {emptyCtaLabel}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {items.map(item => <ActivityCard key={item.id} item={item} />)}
    </div>
  )
}
