'use client'
// ============================================================================
// FreeTrust — /calendar
// Unified calendar view using react-big-calendar + date-fns localizer.
// Displays gigs, products, services, events, reminders and manual entries
// for the authenticated user with optional Google Calendar sync.
// ============================================================================
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams }               from 'next/navigation'
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
  const [title,       setTitle]       = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [startAt,     setStartAt]     = useState(
    event?.start_at
      ? event.start_at.slice(0, 16)
      : (newStart ? format(newStart, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  )
  const [endAt, setEndAt] = useState(
    event?.end_at ? event.end_at.slice(0, 16) : ''
  )
  const [location,    setLocation]    = useState(event?.location ?? '')
  const [allDay,      setAllDay]      = useState(event?.all_day ?? false)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  const isEditable = creating || event?.source_type === 'manual' || event?.source_type === 'reminder'

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description || undefined,
        start_at: new Date(startAt).toISOString(),
        end_at:   endAt ? new Date(endAt).toISOString() : undefined,
        all_day:  allDay,
        location: location || undefined,
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
    : '#6c63ff'

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      zIndex:     300,
      display:    'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'absolute',
          inset:      0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position:       'relative',
        zIndex:         1,
        width:          'min(420px, 100vw)',
        height:         '100vh',
        background:     '#13131a',
        borderLeft:     '1px solid #2a2a3d',
        display:        'flex',
        flexDirection:  'column',
        overflowY:      'auto',
        animation:      'slideInDrawer 0.22s ease',
      }}>
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '1.25rem 1.5rem',
          borderBottom:   '1px solid #2a2a3d',
          background:     '#1c1c27',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {event && (
              <span style={{
                width:        10,
                height:       10,
                borderRadius: '50%',
                background:   sourceColor,
                flexShrink:   0,
                display:      'inline-block',
                boxShadow:    `0 0 6px ${sourceColor}88`,
              }}/>
            )}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e8e8f0', margin: 0 }}>
              {creating ? 'New Event' : (isEditable ? 'Edit Event' : 'Event Details')}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: '#2a2a3d',
              border: 'none',
              color: '#8888aa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Source badge */}
          {event && !creating && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              background: `${sourceColor}22`,
              color: sourceColor,
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              alignSelf: 'flex-start',
              border: `1px solid ${sourceColor}44`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sourceColor, display: 'inline-block' }}/>
              {SOURCE_TYPE_LABELS[event.source_type] ?? event.source_type}
            </span>
          )}

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Title</label>
            {isEditable ? (
              <input
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Event title"
                autoFocus
                style={{ fontSize: '16px' }}
              />
            ) : (
              <p style={{ color: '#e8e8f0', fontWeight: 600 }}>{event?.title}</p>
            )}
          </div>

          {/* Start */}
          <div className="form-group">
            <label className="form-label">Start</label>
            {isEditable ? (
              <input
                className="form-input"
                type="datetime-local"
                value={startAt}
                onChange={e => setStartAt(e.target.value)}
                style={{ fontSize: '16px' }}
              />
            ) : (
              <p style={{ color: '#e8e8f0' }}>
                {event?.start_at ? new Date(event.start_at).toLocaleString('en-IE') : '—'}
              </p>
            )}
          </div>

          {/* End */}
          <div className="form-group">
            <label className="form-label">End</label>
            {isEditable ? (
              <input
                className="form-input"
                type="datetime-local"
                value={endAt}
                onChange={e => setEndAt(e.target.value)}
                style={{ fontSize: '16px' }}
              />
            ) : (
              <p style={{ color: '#e8e8f0' }}>
                {event?.end_at ? new Date(event.end_at).toLocaleString('en-IE') : '—'}
              </p>
            )}
          </div>

          {/* All day */}
          {isEditable && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ color: '#8888aa', fontSize: '0.9rem' }}>All-day event</span>
            </label>
          )}

          {/* Location */}
          <div className="form-group">
            <label className="form-label">Location</label>
            {isEditable ? (
              <input
                className="form-input"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Optional location"
                style={{ fontSize: '16px' }}
              />
            ) : (
              <p style={{ color: '#e8e8f0' }}>{event?.location || '—'}</p>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            {isEditable ? (
              <textarea
                className="form-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional notes…"
                rows={3}
                style={{ fontSize: '16px' }}
              />
            ) : (
              <p style={{ color: '#e8e8f0' }}>{event?.description || '—'}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        {(isEditable || creating) && (
          <div style={{
            padding:        '1rem 1.5rem',
            borderTop:      '1px solid #2a2a3d',
            display:        'flex',
            gap:            '0.75rem',
          }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, minHeight: 44 }}
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving…' : (creating ? 'Create' : 'Save Changes')}
            </button>
            {!creating && event?.source_type === 'manual' && (
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ minHeight: 44 }}
              >
                {deleting ? '…' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
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
        background: 'rgba(108,99,255,0.1)',
        border: '1px solid rgba(108,99,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '0.25rem',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
          color: '#6c63ff',
          background: 'rgba(108,99,255,0.1)',
          border: '1px solid rgba(108,99,255,0.3)',
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
    const res = await fetch('/api/calendar/google/connect', { method: 'POST' })
    if (!res.ok) { showToast('Failed to start Google auth', 'error'); return }
    const { url } = await res.json()
    window.location.href = url
  }

  // ── Google sync ───────────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/google/sync', { method: 'POST' })
      const d   = await res.json()
      if (!res.ok) {
        if (d.reconnect) {
          // Token expired — update UI to show disconnected state
          setGoogleConnected(false)
          setGoogleSyncedAt(null)
          showToast('Google Calendar disconnected — please reconnect', 'error')
        } else {
          showToast(d.error ?? 'Sync failed', 'error')
        }
        return
      }
      setGoogleSyncedAt(d.synced_at)
      await fetchEvents(date)
      showToast(`Synced! ↓${d.pulled} from Google, ↑${d.pushed} pushed`, 'success')
    } catch { showToast('Sync failed', 'error') }
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
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
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
          border-color: #6c63ff;
        }
        .rbc-toolbar button.rbc-active {
          background: #6c63ff;
          color: #fff;
          border-color: #6c63ff;
          box-shadow: 0 0 12px rgba(108,99,255,0.35);
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
        .rbc-off-range-bg { background: rgba(255,255,255,0.015); }
        .rbc-today { background: rgba(108,99,255,0.08) !important; }
        .rbc-date-cell {
          color: #8888aa;
          font-size: 0.8rem;
          padding: 0.3rem 0.5rem;
        }
        .rbc-date-cell.rbc-now {
          color: #6c63ff;
          font-weight: 800;
        }
        .rbc-row-segment .rbc-event { border-radius: 5px; }
        .rbc-show-more {
          color: #6c63ff;
          font-size: 0.75rem;
          font-weight: 600;
          background: transparent;
        }

        /* Time grid */
        .rbc-time-header, .rbc-time-gutter {
          color: #8888aa;
          font-size: 0.75rem;
        }
        .rbc-time-slot { border-color: #2a2a3d; }
        .rbc-timeslot-group { border-color: #2a2a3d; }
        .rbc-time-content { border-color: #2a2a3d; }
        .rbc-day-slot .rbc-time-slot { border-color: rgba(42,42,61,0.5); }

        /* Agenda view */
        .rbc-agenda-table { color: #e8e8f0; width: 100%; }
        .rbc-agenda-table thead > tr > th {
          background: #1a1a2e;
          color: #8888aa;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.55rem 1rem;
          border-bottom: 1px solid #2a2a3d;
        }
        .rbc-agenda-date-cell, .rbc-agenda-time-cell {
          color: #8888aa;
          font-size: 0.82rem;
          padding: 0.75rem 0.875rem;
          white-space: nowrap;
        }
        .rbc-agenda-event-cell {
          font-size: 0.88rem;
          padding: 0.75rem 0.875rem;
        }
        .rbc-agenda-table tbody > tr {
          border-bottom: 1px solid rgba(42,42,61,0.7);
        }
        .rbc-agenda-table tbody > tr:hover {
          background: rgba(108,99,255,0.06);
        }
        .rbc-agenda-table .rbc-agenda-date-cell {
          font-weight: 600;
          color: #6c63ff;
          font-size: 0.8rem;
        }

        /* Selection */
        .rbc-slot-selection { background: rgba(108,99,255,0.15); }
        .rbc-selected { box-shadow: 0 0 0 2px #6c63ff; }

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
      `}</style>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.35rem' }}>
            {/* Gradient icon circle */}
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6c63ff, #00d4aa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.45rem',
              flexShrink: 0,
              boxShadow: '0 2px 16px rgba(108,99,255,0.35)',
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
            background: 'linear-gradient(90deg, rgba(108,99,255,0.5), rgba(0,212,170,0.25), transparent)',
            borderRadius: 1,
          }}/>
        </div>

        {/* ── Action bar ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          {/* Top row: Google Calendar status + settings gear */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            {googleConnected ? (
              /* Connected: compact sync status + sync button */
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
              background: 'linear-gradient(135deg, #6c63ff, #7c6fff)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 48,
              boxShadow: '0 2px 16px rgba(108,99,255,0.4)',
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
        <div style={{
          background: '#13131a',
          borderRadius: '16px',
          border: '1px solid #2a2a3d',
          overflow: 'hidden',
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
                borderTopColor: '#6c63ff',
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
              style={{ height: 'calc(100vh - 320px)', minHeight: 460 }}
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
          borderTopColor: '#6c63ff',
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
