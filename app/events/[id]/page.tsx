'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import PriceDisplay from '@/components/currency/PriceDisplay'
import LocationBadge from '@/components/location/LocationBadge'
import { type CurrencyCode } from '@/context/CurrencyContext'
import { type MapEvent } from '@/components/events/EventsMap'

// Dynamically import the map to avoid SSR Leaflet errors
const EventsMap = dynamic(() => import('@/components/events/EventsMap'), { ssr: false })
// Dynamically import Apple/Google Pay button — client-only, only renders when wallet pay is available
const AppleGooglePayButton = dynamic(() => import('@/components/payments/AppleGooglePayButton'), { ssr: false })

interface DBEvent {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[] | null
  starts_at: string
  ends_at: string | null
  timezone: string | null
  is_online: boolean
  venue_name: string | null
  venue_address: string | null
  meeting_url: string | null
  is_paid: boolean
  ticket_price: number | null
  ticket_price_eur: number | null
  currency_code: string | null
  max_attendees: number | null
  attendee_count: number
  organiser_name: string | null
  organiser_bio: string | null
  country: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  location_label: string | null
  external_url: string | null
  status: string
  is_platform_curated: boolean
}

const CAT_GRADIENTS: Record<string, string> = {
  Community:     'linear-gradient(135deg,#0ea5e9,#0369a1)',
  Business:      'linear-gradient(135deg,#7c3aed,#4c1d95)',
  Technology:    'linear-gradient(135deg,#059669,#047857)',
  Design:        'linear-gradient(135deg,#db2777,#9d174d)',
  Finance:       'linear-gradient(135deg,#d97706,#92400e)',
  Sustainability:'linear-gradient(135deg,#059669,#065f46)',
  FreeTrust:     'linear-gradient(135deg,#0284c7,#1e40af)',
  Health:        'linear-gradient(135deg,#ea580c,#c2410c)',
  Education:     'linear-gradient(135deg,#7c3aed,#4338ca)',
  AI:            'linear-gradient(135deg,#a855f7,#6d28d9)',
  Startup:       'linear-gradient(135deg,#0284c7,#1e40af)',
  Marketing:     'linear-gradient(135deg,#ea580c,#c2410c)',
  Web3:          'linear-gradient(135deg,#4f46e5,#3730a3)',
  'E-commerce':  'linear-gradient(135deg,#d97706,#b45309)',
}

const CAT_COLORS: Record<string, string> = {
  Community: '#38bdf8', Business: '#a78bfa', Technology: '#34d399',
  Design: '#f472b6', Finance: '#fbbf24', Sustainability: '#4ade80',
  AI: '#e879f9', Startup: '#38bdf8', Marketing: '#fb923c',
  Web3: '#818cf8', 'E-commerce': '#f59e0b', Health: '#fb923c', Education: '#a78bfa',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
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
  const gradients = Object.values(CAT_GRADIENTS)
  const idx = str.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length
  return gradients[idx]
}

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Loading event…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

export default function EventDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [event, setEvent] = useState<DBEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [rsvped, setRsvped] = useState(false)
  const [copied, setCopied] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    async function load() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            id, title, description, category, tags,
            starts_at, ends_at, timezone,
            is_online, venue_name, venue_address, meeting_url,
            is_paid, ticket_price, ticket_price_eur, currency_code,
            max_attendees, attendee_count,
            organiser_name, organiser_bio,
            country, city, latitude, longitude, location_label,
            external_url, status, is_platform_curated
          `)
          .eq('id', id)
          .maybeSingle()
        if (error || !data) { setNotFound(true); return }
        setEvent(data as DBEvent)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/events/${id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* silent */ }
  }, [id])

  if (loading) return <Spinner />

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

  const isPast = event.ends_at
    ? new Date(event.ends_at) < new Date()
    : new Date(event.starts_at) < new Date()
  const isToday = new Date(event.starts_at).toDateString() === new Date().toDateString()
  const duration = formatDuration(event.starts_at, event.ends_at)
  const gradient = (event.category && CAT_GRADIENTS[event.category]) ?? hashGradient(event.title)
  const catColor = (event.category && CAT_COLORS[event.category]) ?? '#38bdf8'

  const attendeePct = (event.max_attendees && event.max_attendees > 0)
    ? Math.min(100, Math.round((event.attendee_count / event.max_attendees) * 100))
    : null

  const hasMap = typeof event.latitude === 'number' && typeof event.longitude === 'number'

  const mapEvent: MapEvent | null = hasMap ? {
    id: event.id,
    title: event.title,
    latitude: event.latitude,
    longitude: event.longitude,
    starts_at: event.starts_at,
    city: event.city ?? null,
    location_label: event.location_label ?? null,
  } : null

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 58, paddingBottom: 80 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .ev-detail-grid { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; align-items: start; }
        .ev-sidebar-sticky { position: sticky; top: 80px; }
        @media (max-width: 900px) {
          .ev-detail-grid { grid-template-columns: 1fr !important; }
          .ev-sidebar-sticky { position: static !important; }
        }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ background: gradient, minHeight: 240, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '1.5rem 1.5rem 1.75rem' }}>
        {/* Back button */}
        <Link
          href="/events"
          style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          ← Back to Events
        </Link>

        {/* Top-right badges */}
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span style={{ background: event.is_online ? 'rgba(56,189,248,0.92)' : 'rgba(148,163,184,0.92)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>
            {event.is_online ? '💻 ONLINE' : '📍 IN-PERSON'}
          </span>
          {event.is_paid && event.ticket_price && event.ticket_price > 0
            ? <span style={{ background: 'rgba(245,158,11,0.92)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>PAID</span>
            : <span style={{ background: 'rgba(52,211,153,0.92)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>FREE</span>
          }
          {isToday && <span style={{ background: 'rgba(251,191,36,0.92)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>TODAY</span>}
          {isPast && <span style={{ background: 'rgba(100,116,139,0.85)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>PAST</span>}
        </div>

        {/* Category pill */}
        {event.category && (
          <div style={{ marginBottom: 10 }}>
            <span style={{ background: `${catColor}22`, border: `1px solid ${catColor}55`, color: catColor, fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
              {event.category}
            </span>
          </div>
        )}

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(1.4rem,5vw,2.2rem)', fontWeight: 900, color: '#fff', margin: '0 0 0.5rem', lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,0.35)', maxWidth: 700 }}>
          {event.title}
        </h1>

        {/* Date + organiser row below title */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            🗓 {formatDate(event.starts_at)} · {formatTime(event.starts_at)}{duration ? ` (${duration})` : ''}
          </span>
          {event.organiser_name && (
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              by <strong style={{ color: '#fff' }}>{event.organiser_name}</strong>
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.75rem 1.25rem 0' }}>
        <div className="ev-detail-grid">

          {/* ── LEFT: main content ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Description */}
            {event.description && (
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: '1.5rem' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 12px' }}>About this event</h2>
                <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{event.description}</p>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {event.tags.map(tag => (
                  <span key={tag} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Organiser bio / Curated badge */}
            {event.is_platform_curated ? (
              <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  📌
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa', marginBottom: 2 }}>Curated by FreeTrust</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>This event was verified and added by the FreeTrust platform team. All details are sourced from official event websites.</div>
                </div>
              </div>
            ) : event.organiser_name ? (
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: '1.5rem' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 14px' }}>Organiser</h2>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: gradient, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>
                    {event.organiser_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{event.organiser_name}</div>
                    {event.organiser_bio && (
                      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{event.organiser_bio}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Online join link */}
            {event.is_online && event.meeting_url && !isPast && (
              <div style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>🔗 Online Join Link</div>
                  <div style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>{event.meeting_url}</div>
                </div>
                <a href={event.meeting_url} target="_blank" rel="noopener noreferrer"
                  style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '0.5rem 1.25rem', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Join Event →
                </a>
              </div>
            )}

            {/* Venue details (in-person) */}
            {!event.is_online && (event.venue_name || event.venue_address) && (
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: '1.25rem' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 10px' }}>📍 Venue</h2>
                {event.venue_name && <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>{event.venue_name}</div>}
                {event.venue_address && <div style={{ fontSize: 13, color: '#94a3b8' }}>{event.venue_address}</div>}
                <div style={{ marginTop: 10 }}>
                  <LocationBadge
                    label={event.location_label ?? event.venue_name ?? null}
                    remote={false}
                    distanceKm={null}
                    compact={false}
                  />
                </div>
              </div>
            )}

          </div>

          {/* ── RIGHT: sidebar ── */}
          <div className="ev-sidebar-sticky">
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 18, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Price */}
              <div>
                {event.is_paid && event.ticket_price && event.ticket_price > 0 ? (
                  <>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Ticket Price</div>
                    <PriceDisplay
                      amountEur={event.ticket_price_eur ?? event.ticket_price}
                      sourceCode={(event.currency_code ?? 'EUR') as CurrencyCode}
                      sourceAmount={event.ticket_price}
                      size="lg"
                      layout="stacked"
                    />
                  </>
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>Free Entry</div>
                )}
              </div>

              {/* Date */}
              <div style={{ borderTop: '1px solid rgba(56,189,248,0.08)', paddingTop: '0.875rem' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Date & Time</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{formatDate(event.starts_at)}</div>
                <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600, marginTop: 2 }}>
                  {formatTime(event.starts_at)}
                  {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}
                  {duration ? <span style={{ color: '#64748b', fontWeight: 400 }}> ({duration})</span> : null}
                </div>
                {event.timezone && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{event.timezone}</div>}
              </div>

              {/* Location */}
              <div style={{ borderTop: '1px solid rgba(56,189,248,0.08)', paddingTop: '0.875rem' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Location</div>
                <LocationBadge
                  label={event.location_label ?? event.venue_name ?? (event.is_online ? 'Online' : null)}
                  remote={event.is_online}
                  distanceKm={null}
                  compact={false}
                />
              </div>

              {/* Attendee count + progress bar */}
              <div style={{ borderTop: '1px solid rgba(56,189,248,0.08)', paddingTop: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  {event.attendee_count > 0 ? (
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>👥 {event.attendee_count.toLocaleString()} attending</span>
                  ) : (
                    <span style={{ fontSize: 13, color: '#38bdf8' }}>✨ Be the first to attend!</span>
                  )}
                  {event.max_attendees && event.attendee_count > 0 && (
                    <span style={{ fontSize: 12, color: '#64748b' }}>of {event.max_attendees.toLocaleString()}</span>
                  )}
                </div>
                {attendeePct !== null && (
                  <>
                    <div style={{ height: 6, background: 'rgba(56,189,248,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${attendeePct}%`,
                        background: attendeePct > 85
                          ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                          : 'linear-gradient(90deg,#38bdf8,#0284c7)',
                        borderRadius: 999,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: attendeePct > 85 ? '#f59e0b' : '#64748b', marginTop: 4, fontWeight: 600 }}>
                      {attendeePct > 85 ? `🔥 ${attendeePct}% full — filling up!` : `${attendeePct}% capacity`}
                    </div>
                  </>
                )}
              </div>

              {/* CTA button */}
              {!isPast && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Apple Pay / Google Pay express checkout for paid events */}
                  {event.is_paid && event.ticket_price && event.ticket_price > 0 && !event.external_url && (
                    <>
                      <AppleGooglePayButton
                        amountCents={Math.round((event.ticket_price_eur ?? event.ticket_price) * 100)}
                        currency={(event.currency_code ?? 'EUR').toUpperCase()}
                        label={event.title ?? 'Event Ticket'}
                        description={`Ticket: ${event.title}`}
                        metadata={{ type: 'event_ticket', event_id: event.id }}
                        onSuccess={() => {
                          setRsvped(true)
                          setPayError(null)
                        }}
                        onError={(msg) => setPayError(msg)}
                      />
                      {payError && (
                        <div style={{ color: '#f87171', fontSize: 12, marginTop: 2 }}>{payError}</div>
                      )}
                    </>
                  )}

                  {event.external_url ? (
                    <a
                      href={event.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', textAlign: 'center', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', fontWeight: 800, fontSize: 15, padding: '0.875rem', borderRadius: 12, textDecoration: 'none', letterSpacing: '0.01em' }}
                    >
                      {event.is_paid ? '🎟 Get Tickets →' : '✅ Register Free →'}
                    </a>
                  ) : (
                    <button
                      onClick={() => setRsvped(v => !v)}
                      style={{ background: rsvped ? '#34d399' : 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 12, padding: '0.875rem', fontSize: 15, fontWeight: 800, color: rsvped ? '#0f172a' : '#fff', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.01em' }}
                    >
                      {rsvped ? "✓ You're going!" : event.is_paid ? '🎟 Buy Ticket' : '✅ RSVP Free'}
                    </button>
                  )}

                  <button
                    onClick={copyLink}
                    style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, padding: '0.65rem', fontSize: 13, fontWeight: 600, color: copied ? '#34d399' : '#38bdf8', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    {copied ? '✓ Link copied!' : '↗ Share event'}
                  </button>
                </div>
              )}

              {isPast && (
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(100,116,139,0.1)', borderRadius: 10, fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                  This event has ended
                </div>
              )}

              {/* Trust reward */}
              <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🛡</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>Earn ₮15 Trust tokens</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Awarded when you attend this event.</div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Map ── */}
        {hasMap && mapEvent && (
          <div style={{ marginTop: '1.75rem' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 12px' }}>📍 Event Location</h2>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.1)' }}>
              <EventsMap
                events={[mapEvent]}
                height={340}
                center={{ lat: event.latitude as number, lng: event.longitude as number, zoom: 14 }}
              />
            </div>
            {event.venue_address && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📌</span>
                <span>{event.venue_address}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Back link ── */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(56,189,248,0.07)' }}>
          <Link href="/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to all events
          </Link>
        </div>

      </div>
    </div>
  )
}
