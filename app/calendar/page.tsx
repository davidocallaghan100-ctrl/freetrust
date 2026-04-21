'use client'
// ============================================================================
// FreeTrust — /calendar
// Unified calendar view using react-big-calendar + date-fns localizer.
// Displays gigs, products, services, events, reminders and manual entries
// for the authenticated user with optional Google Calendar sync.
// ============================================================================
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams }               from 'next/navigation'
import Link                                         from 'next/link'
import { Calendar, dateFnsLocalizer, Views }        from 'react-big-calendar'
import { format, parse, startOfWeek, getDay,
         startOfMonth, endOfMonth, addMonths,
         subMonths, startOfWeek as sowFn,
         endOfWeek }                                from 'date-fns'
import { enUS }                                     from 'date-fns/locale'
import { createClient }                             from '@/lib/supabase/client'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import type {
  CalendarEventRow,
  RBCEvent,
  CalendarSourceType,
  CreateEventPayload,
} from '@/types/calendar'
import {
  SOURCE_TYPE_COLORS,
  SOURCE_TYPE_LABELS,
} from '@/types/calendar'

// ── date-fns localizer ───────────────────────────────────────────────────────
const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => sowFn(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function rowToRBC(row: CalendarEventRow): RBCEvent {
  const start = new Date(row.start_at)
  const end   = row.end_at ? new Date(row.end_at) : new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id:       row.id,
    title:    row.title,
    start,
    end,
    allDay:   row.all_day,
    resource: row,
  }
}

function eventStyleGetter(event: RBCEvent) {
  const color = event.resource.color
    ?? SOURCE_TYPE_COLORS[event.resource.source_type]
    ?? '#64748b'
  return {
    style: {
      backgroundColor: `${color}cc`,   // slightly transparent for softer look
      border:          `1px solid ${color}`,
      borderLeft:      `3px solid ${color}`,
      borderRadius:    '6px',
      color:           '#fff',
      fontSize:        '0.78rem',
      fontWeight:      600,
      padding:         '2px 6px',
    },
  }
}

// All source types for the filter chips
const ALL_SOURCE_TYPES: CalendarSourceType[] = [
  'gig','product','service','event','reminder','manual',
]

// ── Drawer component ─────────────────────────────────────────────────────────
interface DrawerProps {
  event:    CalendarEventRow | null
  onClose:  () => void
  onSave:   (data: CreateEventPayload, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  creating: boolean
  newStart?: Date | null
}

function EventDrawer({ event, onClose, onSave, onDelete, creating, newStart }: DrawerProps) {
  const [title,        setTitle]        = useState(event?.title ?? '')
  const [description,  setDescription]  = useState(event?.description ?? '')
  const [startAt,      setStartAt]      = useState(
    event?.start_at
      ? event.start_at.slice(0, 16)
      : (newStart ? format(newStart, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  )
  const [endAt,        setEndAt]        = useState(event?.end_at ? event.end_at.slice(0, 16) : '')
  const [location,     setLocation]     = useState(event?.location ?? '')
  const [allDay,       setAllDay]       = useState(event?.all_day ?? false)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  const isEditable = creating || event?.source_type === 'manual' || event?.source_type === 'reminder'

  // Determine the "View" link for non-editable source types
  const viewLink: string | null = (() => {
    if (!event || creating || !event.source_id) return null
    if (event.source_type === 'event')   return `/events/${event.source_id}`
    if (event.source_type === 'product') return `/products/${event.source_id}`
    if (event.source_type === 'gig')     return `/gig-economy`
    if (event.source_type === 'service') return `/services/${event.source_id}`
    return null
  })()

  const viewLabel: string = (() => {
    if (!event) return 'View'
    if (event.source_type === 'event')   return '🎟 View Event'
    if (event.source_type === 'product') return '🛍 View Product'
    if (event.source_type === 'gig')     return '💼 View Gig'
    if (event.source_type === 'service') return '🔧 View Service'
    return 'View'
  })()

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title:       title.trim(),
        description: description || undefined,
        start_at:    new Date(startAt).toISOString(),
        end_at:      endAt ? new Date(endAt).toISOString() : undefined,
        all_day:     allDay,
        location:    location || undefined,
        source_type: creating ? 'manual' : event?.source_type,
      }, event?.id)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!event?.id) return
    setDeleting(true)
    try {
      await onDelete(event.id)
    } finally {
      setDeleting(false)
    }
  }

  const sourceColor = event
    ? (event.color ?? SOURCE_TYPE_COLORS[event.source_type] ?? '#64748b')
    : '#00d4aa'

  // ── Formatted date/time helpers ──────────────────────────────────────────
  function fmtDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  function fmtTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  const descText = event?.description ?? ''
  const descLong = descText.length > 200

  return (
    <>
      {/* Inject slide-up animation */}
      <style>{`
        @keyframes drawerSlideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @media (max-width: 600px) {
          .cal-drawer-panel {
            border-radius: 20px 20px 0 0 !important;
            border-left: none !important;
            border-top: 1px solid rgba(255,255,255,0.08) !important;
            animation: drawerSlideUp 0.28s cubic-bezier(0.34,1.26,0.64,1) !important;
            max-height: 92vh !important;
            height: auto !important;
            width: 100vw !important;
          }
        }
        @media (min-width: 601px) {
          .cal-drawer-panel {
            animation: drawerSlideIn 0.22s ease !important;
          }
        }
      `}</style>

      <div style={{
        position:        'fixed',
        inset:           0,
        zIndex:          300,
        display:         'flex',
        alignItems:      'flex-end',
        justifyContent:  'flex-end',
      }}>
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position:       'absolute',
            inset:          0,
            background:     'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
          }}
        />

        {/* Drawer panel */}
        <div
          className="cal-drawer-panel"
          style={{
            position:      'relative',
            zIndex:        1,
            width:         'min(440px, 100vw)',
            height:        '100vh',
            background:    'rgba(15,23,42,0.97)',
            borderLeft:    '1px solid rgba(255,255,255,0.08)',
            display:       'flex',
            flexDirection: 'column',
            overflowY:     'auto',
          }}
        >
          {/* Colour accent bar at top */}
          <div style={{
            height:     4,
            background: `linear-gradient(90deg, ${sourceColor}, ${sourceColor}88)`,
            flexShrink: 0,
          }}/>

          {/* Header — close button + title */}
          <div style={{
            display:        'flex',
            alignItems:     'flex-start',
            justifyContent: 'space-between',
            padding:        '1.25rem 1.25rem 0.75rem',
            gap:            '0.75rem',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Source type badge */}
              {event && !creating && (
                <span style={{
                  display:       'inline-flex',
                  alignItems:    'center',
                  gap:           '0.35rem',
                  padding:       '0.2rem 0.65rem',
                  borderRadius:  '9999px',
                  background:    `${sourceColor}1a`,
                  color:         sourceColor,
                  fontSize:      '0.7rem',
                  fontWeight:    700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  border:        `1px solid ${sourceColor}33`,
                  marginBottom:  '0.5rem',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sourceColor, display: 'inline-block' }}/>
                  {SOURCE_TYPE_LABELS[event.source_type] ?? event.source_type}
                </span>
              )}
              {/* Event title (view mode) or "New Event" label (create mode) */}
              {!isEditable && event ? (
                <h2 style={{
                  fontSize:   '1.25rem',
                  fontWeight: 800,
                  color:      '#f1f5f9',
                  margin:     0,
                  lineHeight: 1.3,
                  wordBreak:  'break-word',
                }}>
                  {event.title}
                </h2>
              ) : (
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e8e8f0', margin: 0 }}>
                  {creating ? 'New Event' : 'Edit Event'}
                </h3>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                flexShrink:     0,
                width:          34,
                height:         34,
                borderRadius:   '50%',
                background:     'rgba(255,255,255,0.07)',
                border:         '1px solid rgba(255,255,255,0.1)',
                color:          '#94a3b8',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '1rem',
                cursor:         'pointer',
                lineHeight:     1,
              }}
              aria-label="Close"
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: '0.5rem 1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {isEditable ? (
              /* ── EDIT / CREATE FORM ── */
              <>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    className="form-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Event title"
                    autoFocus
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={startAt}
                    onChange={e => setStartAt(e.target.value)}
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={endAt}
                    onChange={e => setEndAt(e.target.value)}
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={e => setAllDay(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ color: '#8888aa', fontSize: '0.9rem' }}>All-day event</span>
                </label>

                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    className="form-input"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Optional location"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Optional notes…"
                    rows={3}
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </>
            ) : (
              /* ── VIEW MODE ── */
              <>
                {/* Date / time row */}
                {event?.start_at && (
                  <div style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        '0.6rem',
                    padding:    '0.7rem 0.9rem',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    border:     '1px solid rgba(255,255,255,0.07)',
                  }}>
                    {/* Calendar icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sourceColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem' }}>
                        {fmtDate(event.start_at)}
                        {' · '}
                        <span style={{ color: sourceColor }}>{fmtTime(event.start_at)}</span>
                        {event.end_at && (
                          <>
                            <span style={{ color: '#475569', margin: '0 0.3rem' }}>→</span>
                            <span style={{ color: '#94a3b8' }}>{fmtTime(event.end_at)}</span>
                          </>
                        )}
                      </div>
                      {event.all_day && (
                        <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>All day</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Location row — only if set */}
                {event?.location && (
                  <div style={{
                    display:    'flex',
                    alignItems: 'flex-start',
                    gap:        '0.6rem',
                    padding:    '0.7rem 0.9rem',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    border:     '1px solid rgba(255,255,255,0.07)',
                  }}>
                    {/* Pin icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.4 }}>
                      {event.location}
                    </span>
                  </div>
                )}

                {/* Description card */}
                {descText && (
                  <div style={{
                    padding:      '0.8rem 0.9rem',
                    background:   'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    border:       '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <p style={{
                      color:      '#94a3b8',
                      fontSize:   '0.85rem',
                      lineHeight: 1.6,
                      margin:     0,
                      overflow:   descExpanded ? 'visible' : 'hidden',
                      display:    descExpanded ? 'block' : '-webkit-box',
                      WebkitLineClamp: descExpanded ? undefined : 4,
                      WebkitBoxOrient: 'vertical' as const,
                    } as React.CSSProperties}>
                      {descText}
                    </p>
                    {descLong && (
                      <button
                        onClick={() => setDescExpanded(v => !v)}
                        style={{
                          marginTop:  '0.4rem',
                          background: 'none',
                          border:     'none',
                          color:      sourceColor,
                          fontSize:   '0.78rem',
                          fontWeight: 600,
                          cursor:     'pointer',
                          padding:    0,
                        }}
                      >
                        {descExpanded ? 'Show less ↑' : 'Show more ↓'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — CTA + edit/delete */}
          <div style={{
            padding:        '0.75rem 1.25rem',
            paddingBottom:  'max(0.75rem, env(safe-area-inset-bottom))',
            borderTop:      '1px solid rgba(255,255,255,0.07)',
            display:        'flex',
            flexDirection:  'column',
            gap:            '0.6rem',
          }}>
            {/* View CTA — only shown in view mode when a link exists */}
            {!isEditable && !creating && viewLink && (
              <Link
                href={viewLink}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '0.4rem',
                  padding:        '0.8rem 1rem',
                  borderRadius:   14,
                  background:     `linear-gradient(135deg, ${sourceColor}, ${sourceColor}cc)`,
                  color:          '#0f172a',
                  fontWeight:     700,
                  fontSize:       '0.95rem',
                  textDecoration: 'none',
                  boxShadow:      `0 4px 16px ${sourceColor}44`,
                  minHeight:      50,
                }}
              >
                {viewLabel} →
              </Link>
            )}

            {/* Save / Delete (editable events only) */}
            {isEditable && (
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, minHeight: 46 }}
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                >
                  {saving ? 'Saving…' : (creating ? 'Create Event' : 'Save Changes')}
                </button>
                {!creating && event?.source_type === 'manual' && (
                  <button
                    className="btn btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ minHeight: 46 }}
                  >
                    {deleting ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Empty state component ─────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '3rem 1.5rem', gap: '0.75rem',
      textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64,
        borderRadius: '50%',
        background: 'rgba(0,212,170,0.1)',
        border: '1px solid rgba(0,212,170,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '0.25rem',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <p style={{ color: '#e8e8f0', fontWeight: 600, fontSize: '1rem', margin: 0 }}>No events yet</p>
      <p style={{ color: '#8888aa', fontSize: '0.85rem', margin: 0, maxWidth: 240 }}>
        Your gigs, orders and events will appear here
      </p>
      <button
        onClick={onNew}
        style={{
          marginTop: '0.5rem',
          color: '#00d4aa',
          background: 'rgba(0,212,170,0.1)',
          border: '1px solid rgba(0,212,170,0.3)',
          borderRadius: '9999px',
          padding: '0.5rem 1.25rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        + Add your first event
      </button>
    </div>
  )
}

// ── Main page (inner – needs Suspense because it uses useSearchParams) ────────
function CalendarPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [events,       setEvents]       = useState<RBCEvent[]>([])
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState<string>(
    typeof window !== 'undefined' && window.innerWidth < 769 ? 'agenda' : 'month'
  )
  const [date,         setDate]         = useState(new Date())
  const [activeTypes,  setActiveTypes]  = useState<Set<CalendarSourceType>>(
    new Set(ALL_SOURCE_TYPES)
  )
  const [drawerEvent,  setDrawerEvent]  = useState<CalendarEventRow | null>(null)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [newStartDate, setNewStartDate] = useState<Date | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleSyncedAt,  setGoogleSyncedAt]  = useState<string | null>(null)
  const [syncing,      setSyncing]      = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; type: 'success'|'error' } | null>(null)

  const allRowsRef = useRef<CalendarEventRow[]>([])

  // Show toast helper
  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Fetch events for the visible range ──────────────────────────────────
  const fetchEvents = useCallback(async (rangeDate: Date) => {
    setLoading(true)
    try {
      const from = startOfMonth(subMonths(rangeDate, 1)).toISOString()
      const to   = endOfMonth(addMonths(rangeDate, 1)).toISOString()
      const res  = await fetch(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      if (res.status === 401) {
        // Not logged in — redirect to login with return URL
        window.location.href = '/login?redirect=/calendar'
        return
      }
      if (!res.ok) throw new Error('Failed to load events')
      const { events: rows } = await res.json() as { events: CalendarEventRow[] }
      allRowsRef.current = rows
      setEvents(rows.map(rowToRBC))
    } catch (err) {
      console.error(err)
      showToast('Failed to load calendar', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // ── Check Google connection ──────────────────────────────────────────────
  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/google/settings')
      if (!res.ok) return
      const d = await res.json()
      setGoogleConnected(d.connected)
      setGoogleSyncedAt(d.synced_at)
    } catch {}
  }, [])

  useEffect(() => {
    fetchEvents(date)
    fetchGoogleStatus()

    // Check if we just returned from Google OAuth
    const connected  = searchParams.get('google_connected')
    const googleErr  = searchParams.get('google_error')
    if (connected)  showToast('Google Calendar connected!', 'success')
    if (googleErr)  showToast(`Google error: ${googleErr}`, 'error')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter events by active source types ────────────────────────────────
  const filteredEvents = events.filter(
    e => activeTypes.has(e.resource.source_type)
  )

  // ── Toggle filter chip ───────────────────────────────────────────────────
  function toggleType(t: CalendarSourceType) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  // ── Click event → open drawer ────────────────────────────────────────────
  function handleSelectEvent(e: RBCEvent) {
    setDrawerEvent(e.resource)
    setCreating(false)
    setDrawerOpen(true)
  }

  // ── Click empty slot → create drawer ────────────────────────────────────
  function handleSelectSlot(slotInfo: { start: Date }) {
    setDrawerEvent(null)
    setNewStartDate(slotInfo.start)
    setCreating(true)
    setDrawerOpen(true)
  }

  // ── Save event (create or update) ────────────────────────────────────────
  const handleSave = useCallback(async (payload: CreateEventPayload, id?: string) => {
    const url    = id ? `/api/calendar/events/${id}` : '/api/calendar/events'
    const method = id ? 'PATCH' : 'POST'
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Failed to save event', 'error')
      return
    }
    const { event: saved } = await res.json() as { event: CalendarEventRow }
    if (id) {
      allRowsRef.current = allRowsRef.current.map(r => r.id === id ? saved : r)
    } else {
      allRowsRef.current = [...allRowsRef.current, saved]
    }
    setEvents(allRowsRef.current.map(rowToRBC))
    setDrawerOpen(false)
    showToast(id ? 'Event updated' : 'Event created', 'success')
  }, [showToast])

  // ── Delete event ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      showToast('Failed to delete event', 'error')
      return
    }
    allRowsRef.current = allRowsRef.current.filter(r => r.id !== id)
    setEvents(allRowsRef.current.map(rowToRBC))
    setDrawerOpen(false)
    showToast('Event deleted', 'success')
  }, [showToast])

  // ── Google connect ────────────────────────────────────────────────────────
  async function handleGoogleConnect() {
    try {
      const res = await fetch('/api/calendar/google/connect', { method: 'POST' })
      if (res.status === 401) {
        // Not logged in — redirect to login
        router.push('/auth/login?redirect=/calendar')
        return
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        showToast(d.error ?? 'Failed to connect Google Calendar', 'error')
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch {
      showToast('Failed to connect Google Calendar', 'error')
    }
  }

  // ── Google disconnect ─────────────────────────────────────────────────────
  async function handleGoogleDisconnect() {
    try {
      await fetch('/api/calendar/google/disconnect', { method: 'POST' })
    } catch {}
    setGoogleConnected(false)
    setGoogleSyncedAt(null)
    showToast('Google Calendar disconnected', 'success')
  }

  // ── Google sync ───────────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/google/sync', { method: 'POST' })
      const d   = await res.json()
      if (!res.ok) {
        if (d.reconnect || res.status === 401 || res.status === 403) {
          // Token expired or revoked — switch to disconnected state
          setGoogleConnected(false)
          setGoogleSyncedAt(null)
          showToast(d.error ?? 'Google Calendar disconnected — please reconnect', 'error')
        } else {
          showToast(d.error ?? 'Sync failed. Please try again.', 'error')
        }
        return
      }
      setGoogleSyncedAt(d.synced_at)
      await fetchEvents(date)
      showToast(`Synced! ↓${d.pulled} from Google, ↑${d.pushed} pushed`, 'success')
    } catch { showToast('Sync failed. Please try again.', 'error') }
    finally   { setSyncing(false) }
  }

  // ── Navigate calendar ─────────────────────────────────────────────────────
  function handleNavigate(newDate: Date) {
    setDate(newDate)
    fetchEvents(newDate)
  }

  const syncedLabel = googleSyncedAt
    ? `Synced ${new Date(googleSyncedAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`
    : 'Never synced'

  const openNewEvent = () => {
    setDrawerEvent(null)
    setNewStartDate(null)
    setCreating(true)
    setDrawerOpen(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', overflowX: 'hidden' }}>
      {/* ── Inline calendar CSS overrides ── */}
      <style>{`
        /* Base calendar */
        .rbc-calendar {
          background: #13131a;
          color: #e8e8f0;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #2a2a3d;
        }

        /* Toolbar */
        .rbc-toolbar {
          padding: 0.875rem 1rem;
          background: #1c1c27;
          border-bottom: 1px solid #2a2a3d;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .rbc-toolbar button {
          color: #8888aa;
          background: transparent;
          border: 1px solid #2a2a3d;
          border-radius: 8px;
          padding: 0.45rem 0.875rem;
          font-size: 0.82rem;
          font-weight: 600;
          transition: all 0.15s;
          cursor: pointer;
          min-height: 36px;
        }
        .rbc-toolbar button:hover {
          background: #2a2a3d;
          color: #e8e8f0;
          border-color: #38bdf8;
        }
        .rbc-toolbar button.rbc-active {
          background: #38bdf8;
          color: #0a0a0f;
          border-color: #38bdf8;
          box-shadow: 0 0 12px rgba(56,189,248,0.35);
        }
        .rbc-toolbar-label {
          font-weight: 700;
          font-size: 1rem;
          color: #e8e8f0;
          flex: 1;
          text-align: center;
        }
        .rbc-btn-group { display: flex; gap: 4px; }

        /* Headers */
        .rbc-header {
          background: #1c1c27;
          color: #8888aa;
          font-size: 0.73rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          padding: 0.6rem 0.4rem;
          border-color: #2a2a3d;
        }

        /* Day backgrounds */
        .rbc-day-bg, .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
          background: #13131a;
        }

        /* Agenda — vertical scroll on mobile, no horizontal overflow */
        .rbc-agenda-view {
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch;
        }
        /* Let the agenda table flow naturally, no forced min-width */
        .rbc-agenda-table {
          width: 100%;
          table-layout: fixed;
        }
        /* Compact columns on mobile so EVENT has room */
        .rbc-agenda-table .rbc-agenda-date-cell {
          width: 70px;
          min-width: 70px;
          max-width: 70px;
          word-break: break-word;
        }
        .rbc-agenda-table .rbc-agenda-time-cell {
          width: 90px;
          min-width: 90px;
          max-width: 90px;
          word-break: break-word;
        }
        .rbc-agenda-table .rbc-agenda-event-cell {
          word-break: break-word;
          white-space: normal !important;
        }
        .rbc-off-range-bg { background: rgba(255,255,255,0.015); }
        .rbc-today { background: rgba(56,189,248,0.08) !important; }
        .rbc-date-cell {
          color: #8888aa;
          font-size: 0.8rem;
          padding: 0.3rem 0.5rem;
        }
        .rbc-date-cell.rbc-now {
          color: #38bdf8;
          font-weight: 800;
        }
        .rbc-row-segment .rbc-event { border-radius: 5px; }
        .rbc-show-more {
          color: #00d4aa;
          font-size: 0.75rem;
          font-weight: 600;
          background: transparent;
        }

        /* Time grid */
        .rbc-time-header, .rbc-time-gutter {
          color: #94a3b8;
          font-size: 0.75rem;
        }
        .rbc-time-slot { border-color: #2a2a3d; }
        .rbc-timeslot-group { border-color: #2a2a3d; }
        .rbc-time-content { border-color: #2a2a3d; }
        .rbc-day-slot .rbc-time-slot { border-color: rgba(42,42,61,0.5); }

        /* Agenda view */
        .rbc-agenda-table { color: #f1f5f9; width: 100%; }
        .rbc-agenda-table thead > tr > th {
          background: #0d0d1a;
          color: #94a3b8;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.55rem 1rem;
          border-bottom: 1px solid #2a2a3d;
        }
        .rbc-agenda-date-cell, .rbc-agenda-time-cell {
          color: #cbd5e1;
          font-size: 0.78rem;
          font-weight: 500;
          padding: 0.65rem 0.5rem;
          white-space: normal;
          word-break: break-word;
        }
        .rbc-agenda-event-cell {
          color: #f1f5f9;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.65rem 0.5rem;
          white-space: normal;
          word-break: break-word;
        }
        .rbc-agenda-table tbody > tr {
          border-bottom: 1px solid rgba(42,42,61,0.7);
        }
        .rbc-agenda-table tbody > tr:hover {
          background: rgba(0,212,170,0.05);
        }
        .rbc-agenda-table .rbc-agenda-date-cell {
          font-weight: 700;
          color: #00d4aa;
          font-size: 0.8rem;
        }
        .rbc-agenda-table .rbc-agenda-time-cell {
          color: #cbd5e1;
          font-weight: 500;
        }

        /* Selection */
        .rbc-slot-selection { background: rgba(0,212,170,0.1); }
        .rbc-selected { box-shadow: 0 0 0 2px #00d4aa; }

        /* Kill the baby blue row highlight when clicking agenda rows */
        .rbc-agenda-table tbody > tr.rbc-selected,
        .rbc-agenda-table tbody > tr:focus,
        .rbc-agenda-table tbody > tr:active,
        .rbc-agenda-table tbody > tr td.rbc-selected,
        .rbc-agenda-table .rbc-selected {
          background: rgba(0,212,170,0.06) !important;
        }
        /* Remove default browser blue text-selection highlight */
        .rbc-agenda-table ::selection {
          background: rgba(0,212,170,0.2);
        }
        /* Kill any lingering blue backgrounds on agenda cells */
        .rbc-agenda-table td:focus,
        .rbc-agenda-table tr:focus {
          outline: none;
          background: rgba(0,212,170,0.06) !important;
        }

        /* ── Event colours handled in globals.css ──
           Base .rbc-event override (teal) lives in globals.css so it
           beats the library's cascade order. Individual event colours
           come through eventPropGetter as inline styles, which always
           win over any CSS class rule (including !important). */

        /* Borders */
        .rbc-month-row { border-color: #2a2a3d; }
        .rbc-day-bg + .rbc-day-bg { border-color: #2a2a3d; }
        .rbc-header + .rbc-header { border-color: #2a2a3d; }
        .rbc-month-view .rbc-month-row + .rbc-month-row { border-color: #2a2a3d; }

        /* Drawer animation */
        @keyframes slideInDrawer {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }

        /* Agenda empty */
        .rbc-agenda-empty {
          color: #55556a;
          padding: 2rem;
          text-align: center;
          font-size: 0.9rem;
        }

        /* Mobile agenda — stack date/time above event for readability */
        @media (max-width: 480px) {
          .rbc-agenda-table {
            table-layout: auto;
          }
          .rbc-agenda-table .rbc-agenda-date-cell,
          .rbc-agenda-table .rbc-agenda-time-cell {
            font-size: 0.72rem;
            padding: 0.5rem 0.4rem;
          }
          .rbc-agenda-table .rbc-agenda-event-cell {
            font-size: 0.82rem;
            padding: 0.5rem 0.4rem;
          }
          /* Reduce toolbar button padding on mobile */
          .rbc-toolbar button {
            padding: 0.35rem 0.6rem;
            font-size: 0.75rem;
          }
          .rbc-toolbar-label {
            font-size: 0.88rem;
          }
        }

        /* Ensure the rbc-calendar itself doesn't clip agenda scroll */
        .rbc-calendar.rbc-agenda-view-open {
          overflow: visible !important;
        }
        /* Make the agenda content area scrollable if it overflows */
        .rbc-agenda-view table.rbc-agenda-table tbody {
          display: block;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .rbc-agenda-view table.rbc-agenda-table thead {
          display: table;
          width: 100%;
          table-layout: fixed;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody tr {
          display: table;
          width: 100%;
          table-layout: fixed;
        }
      `}</style>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '1.25rem 1rem 6rem' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.35rem' }}>
            {/* Gradient icon circle */}
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #38bdf8, #00d4aa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.45rem',
              flexShrink: 0,
              boxShadow: '0 2px 16px rgba(56,189,248,0.35)',
            }}>
              🗓️
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e8e8f0', margin: 0, lineHeight: 1.2 }}>
                My Calendar
              </h1>
              <p style={{ color: '#8888aa', fontSize: '0.82rem', margin: 0, marginTop: '0.1rem' }}>
                Gigs, deliveries, events &amp; reminders — all in one place
              </p>
            </div>
          </div>

          {/* Gradient divider */}
          <div style={{
            height: 1,
            marginTop: '0.875rem',
            background: 'linear-gradient(90deg, rgba(56,189,248,0.5), rgba(0,212,170,0.25), transparent)',
            borderRadius: 1,
          }}/>
        </div>

        {/* ── Action bar ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          {/* Top row: Google Calendar status + settings gear */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            {googleConnected ? (
              /* Connected: compact sync status + sync button + disconnect */
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.75rem', color: '#8888aa',
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d4aa', display: 'inline-block', boxShadow: '0 0 4px #00d4aa' }}/>
                  {syncedLabel}
                </span>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.4rem 0.875rem',
                    borderRadius: '9999px',
                    border: '1px solid #2a2a3d',
                    background: '#1c1c27',
                    color: '#e8e8f0',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: syncing ? 'wait' : 'pointer',
                    minHeight: 36,
                    opacity: syncing ? 0.6 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>{syncing ? '⏳' : '🔄'}</span>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  onClick={handleGoogleDisconnect}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '9999px',
                    border: '1px solid #3a2a2a',
                    background: 'transparent',
                    color: '#8888aa',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    minHeight: 32,
                    transition: 'all 0.15s',
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              /* Not connected: prominent connect button */
              <button
                onClick={handleGoogleConnect}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.6rem 1.1rem',
                  borderRadius: '12px',
                  border: '1.5px solid #38bdf8',
                  background: 'rgba(56,189,248,0.07)',
                  color: '#38bdf8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 44,
                  transition: 'all 0.15s',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                Connect Google Calendar
              </button>
            )}

            {/* Settings gear */}
            <button
              onClick={() => router.push('/settings/calendar')}
              title="Calendar settings"
              style={{
                width: 44, height: 44,
                borderRadius: '10px',
                border: '1px solid #2a2a3d',
                background: '#13131a',
                color: '#8888aa',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ⚙️
            </button>
          </div>

          {/* Bottom row: + New event button (full width on mobile) */}
          <button
            onClick={openNewEvent}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              padding: '0.65rem 1.1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #00d4aa, #38bdf8)',
              color: '#0a0a0f',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 48,
              boxShadow: '0 2px 16px rgba(0,212,170,0.35)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
            New Event
          </button>
        </div>

        {/* ── Filter chips ── */}
        <div style={{
          display: 'flex',
          gap: '0.45rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          paddingRight: '1rem',
          marginBottom: '1.25rem',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as React.CSSProperties}>
          {ALL_SOURCE_TYPES.map(t => {
            const active = activeTypes.has(t)
            const color  = SOURCE_TYPE_COLORS[t]
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:          '0.35rem',
                  padding:      '0.4rem 0.875rem',
                  borderRadius: '9999px',
                  border:       `1.5px solid ${active ? color : '#2a2a3d'}`,
                  background:   active ? `${color}1a` : '#13131a',
                  color:        active ? color : '#55556a',
                  fontSize:     '0.75rem',
                  fontWeight:   700,
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace:   'nowrap',
                  flexShrink:   0,
                  minHeight:    36,
                  boxShadow:    active ? `0 0 8px ${color}33` : 'none',
                }}
              >
                <span style={{
                  width:        9,
                  height:       9,
                  borderRadius: '50%',
                  background:   active ? color : '#2a2a3d',
                  display:      'inline-block',
                  flexShrink:   0,
                  boxShadow:    active ? `0 0 4px ${color}` : 'none',
                }}/>
                {SOURCE_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>

        {/* ── Calendar ── */}
        <div className="ft-calendar-wrap" style={{
          background: '#13131a',
          borderRadius: '16px',
          border: '1px solid #2a2a3d',
          overflow: 'visible',
        }}>
          {loading ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '4rem 2rem', gap: '1rem',
              color: '#8888aa',
            }}>
              <div style={{
                width: 36, height: 36,
                border: '3px solid #2a2a3d',
                borderTopColor: '#38bdf8',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}/>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ fontSize: '0.88rem' }}>Loading your calendar…</span>
            </div>
          ) : filteredEvents.length === 0 && view === 'agenda' ? (
            <EmptyState onNew={openNewEvent} />
          ) : (
            <Calendar
              localizer={localizer}
              events={filteredEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: view === 'agenda' ? 'auto' : 'calc(100vh - 260px)', minHeight: view === 'agenda' ? 300 : 460 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              view={view as any}
              onView={(v: string) => setView(v)}
              date={date}
              onNavigate={handleNavigate}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              eventPropGetter={eventStyleGetter}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              messages={{
                agenda:    'Agenda',
                month:     'Month',
                week:      'Week',
                day:       'Day',
                today:     'Today',
                next:      '›',
                previous:  '‹',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                showMore:  (total: any) => `+${total} more`,
                noEventsInRange: ' ',
              } as Record<string, unknown>}
            />
          )}
        </div>

      </div>

      {/* ── Event drawer ── */}
      {drawerOpen && (
        <EventDrawer
          event={drawerEvent}
          onClose={() => setDrawerOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          creating={creating}
          newStart={newStartDate}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 400,
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '9999px',
            background: toast.type === 'success' ? 'rgba(6,214,160,0.15)' : 'rgba(255,77,109,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(6,214,160,0.4)' : 'rgba(255,77,109,0.4)'}`,
            color: toast.type === 'success' ? '#06d6a0' : '#ff4d6d',
            fontSize: '0.85rem',
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <span>{toast.type === 'success' ? '✓' : '✕'}</span>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Default export wrapped in Suspense (required for useSearchParams) ─────────
export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#0a0a0f',
        flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid #2a2a3d',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#38bdf8', fontSize: '0.9rem' }}>Loading calendar…</span>
      </div>
    }>
      <CalendarPageInner />
    </Suspense>
  )
}
