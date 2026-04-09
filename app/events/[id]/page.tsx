'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DBEvent {
  id: string
  community_id: string | null
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  is_online: boolean
  meeting_url: string | null
  attendee_count: number
  created_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(start: string, end: string | null) {
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

function hashGradient(str: string) {
  const gradients = [
    'linear-gradient(135deg,#0ea5e9,#0369a1)',
    'linear-gradient(135deg,#7c3aed,#4c1d95)',
    'linear-gradient(135deg,#059669,#047857)',
    'linear-gradient(135deg,#db2777,#9d174d)',
    'linear-gradient(135deg,#d97706,#92400e)',
    'linear-gradient(135deg,#0284c7,#1e40af)',
  ]
  const idx = str.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length
  return gradients[idx]
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [event, setEvent] = useState<DBEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [rsvped, setRsvped] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    async function load() {
      try {
        const { data, error } = await supabase
          .from('community_events')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error || !data) { setNotFound(true); return }
        setEvent(data)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/events/${id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading event…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (notFound || !event) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, gap: 16 }}>
        <div style={{ fontSize: '3rem' }}>📅</div>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>Event not found</h1>
        <p style={{ color: '#64748b', margin: 0 }}>This event may have been removed or the link is invalid.</p>
        <Link href="/events" style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 700, padding: '0.6rem 1.5rem', borderRadius: 10, textDecoration: 'none', marginTop: 8 }}>
          Browse Events
        </Link>
      </div>
    )
  }

  const isPast = event.ends_at ? new Date(event.ends_at) < new Date() : new Date(event.starts_at) < new Date()
  const isToday = new Date(event.starts_at).toDateString() === new Date().toDateString()
  const duration = formatDuration(event.starts_at, event.ends_at)
  const gradient = hashGradient(event.title)

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 58, paddingBottom: 80 }}>

      {/* Hero banner */}
      <div style={{ background: gradient, minHeight: 200, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '1.5rem' }}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back
        </button>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ background: event.is_online ? 'rgba(56,189,248,0.9)' : 'rgba(148,163,184,0.9)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>
            {event.is_online ? '💻 Online' : '📍 In Person'}
          </span>
          {isToday && <span style={{ background: 'rgba(251,191,36,0.9)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>TODAY</span>}
          {isPast && <span style={{ background: 'rgba(100,116,139,0.9)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>PAST EVENT</span>}
        </div>

        <h1 style={{ fontSize: 'clamp(1.3rem,5vw,2rem)', fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          {event.title}
        </h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem 1.25rem' }}>

        {/* Key info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: '1.5rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Date</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{formatDate(event.starts_at)}</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Time</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
              {formatTime(event.starts_at)}
              {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}
            </div>
            {duration && <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>{duration}</div>}
          </div>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Attending</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>👥 {event.attendee_count} people</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Format</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: event.is_online ? '#38bdf8' : '#34d399' }}>
              {event.is_online ? '💻 Online' : '📍 In Person'}
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 10px' }}>About this event</h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{event.description}</p>
          </div>
        )}

        {/* Online link */}
        {event.is_online && event.meeting_url && !isPast && (
          <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>🔗 Join Link</div>
              <div style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all' }}>{event.meeting_url}</div>
            </div>
            <a
              href={event.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '13px', padding: '0.5rem 1.25rem', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Join Event →
            </a>
          </div>
        )}

        {/* Trust reward banner */}
        <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🛡</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>Earn ₮15 Trust tokens</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>Awarded automatically when you attend this event.</div>
          </div>
        </div>

        {/* RSVP + Share actions */}
        {!isPast && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <button
              onClick={() => setRsvped(v => !v)}
              style={{
                flex: 1, minWidth: 140,
                background: rsvped ? '#34d399' : 'linear-gradient(135deg,#38bdf8,#0284c7)',
                border: 'none', borderRadius: 12,
                padding: '0.875rem', fontSize: '15px', fontWeight: 700,
                color: rsvped ? '#0f172a' : '#fff', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {rsvped ? '✓ You\'re going!' : '🎟 RSVP Free'}
            </button>
            <button
              onClick={copyLink}
              style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, padding: '0.875rem 1.25rem', fontSize: '14px', fontWeight: 600, color: copied ? '#34d399' : '#38bdf8', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {copied ? '✓ Copied!' : '↗ Share'}
            </button>
          </div>
        )}

        {/* Back to events */}
        <Link
          href="/events"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '13px', color: '#64748b', textDecoration: 'none', marginTop: 8 }}
        >
          ← All Events
        </Link>
      </div>
    </div>
  )
}
