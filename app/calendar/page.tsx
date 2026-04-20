'use client'
// ============================================================================
// FreeTrust — /calendar
// Unified calendar view using react-big-calendar + date-fns localizer.
// Displays gigs, products, services, events, reminders and manual entries
// for the authenticated user with optional Google Calendar sync.
// ============================================================================
import { useEffect, useState, useCallback, useRef } from 'react'
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
      backgroundColor: color,
      border:          'none',
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
          background: 'rgba(0,0,0,0.55)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position:       'relative',
        zIndex:         1,
        width:          'min(420px, 100vw)',
        height:         '100vh',
        background:     'var(--color-surface)',
        borderLeft:     '1px solid var(--color-border)',
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
          borderBottom:   '1px solid var(--color-border)',
          background:     'var(--color-surface-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {event && (
              <span style={{
                width:        '10px',
                height:       '10px',
                borderRadius: '50%',
                background:   sourceColor,
                flexShrink:   0,
                display:      'inline-block',
              }}/>
            )}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {creating ? 'New Event' : (isEditable ? 'Edit Event' : 'Event Details')}
            </h3>
          </div>
          <button onClick={onClose} className="btn-icon btn-ghost" aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Source badge */}
          {event && !creating && (
            <span className="badge" style={{
              background: `${sourceColor}22`,
              color:       sourceColor,
              alignSelf:  'flex-start',
            }}>
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
              />
            ) : (
              <p style={{ color: 'var(--color-text)', fontWeight: 600 }}>{event?.title}</p>
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
              />
            ) : (
              <p style={{ color: 'var(--color-text)' }}>
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
              />
            ) : (
              <p style={{ color: 'var(--color-text)' }}>
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
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>All-day event</span>
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
              />
            ) : (
              <p style={{ color: 'var(--color-text)' }}>{event?.location || '—'}</p>
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
              />
            ) : (
              <p style={{ color: 'var(--color-text)' }}>{event?.description || '—'}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        {(isEditable || creating) && (
          <div style={{
            padding:        '1rem 1.5rem',
            borderTop:      '1px solid var(--color-border)',
            display:        'flex',
            gap:            '0.75rem',
          }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
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
      if (!res.ok) { showToast(d.error ?? 'Sync failed', 'error'); return }
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
    ? `Last synced ${new Date(googleSyncedAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`
    : 'Never synced'

  return (
    <div className="ft-page-content" style={{ minHeight: '100vh' }}>
      {/* Inline calendar CSS overrides for FreeTrust dark theme */}
      <style>{`
        .rbc-calendar {
          background: var(--color-surface);
          color: var(--color-text);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--color-border);
        }
        .rbc-toolbar { padding: 0.75rem 1rem; background: var(--color-surface-2); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: 0.5rem; }
        .rbc-toolbar button { color: var(--color-text-muted); background: transparent; border: 1px solid var(--color-border); border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.82rem; font-weight: 600; transition: all 0.15s; cursor: pointer; }
        .rbc-toolbar button:hover, .rbc-toolbar button.rbc-active { background: var(--color-surface-2); color: var(--color-text); border-color: var(--color-primary); }
        .rbc-toolbar-label { font-weight: 700; font-size: 1rem; color: var(--color-text); }
        .rbc-header { background: var(--color-surface-2); color: var(--color-text-muted); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.5rem; border-color: var(--color-border); }
        .rbc-day-bg, .rbc-month-view, .rbc-time-view, .rbc-agenda-view { background: var(--color-surface); }
        .rbc-off-range-bg { background: rgba(255,255,255,0.02); }
        .rbc-today { background: rgba(108,99,255,0.07) !important; }
        .rbc-date-cell { color: var(--color-text-muted); font-size: 0.8rem; padding: 0.25rem 0.4rem; }
        .rbc-date-cell.rbc-now { color: var(--color-primary); font-weight: 800; }
        .rbc-row-segment .rbc-event { border-radius: 5px; }
        .rbc-show-more { color: var(--color-primary); font-size: 0.75rem; font-weight: 600; }
        .rbc-time-header, .rbc-time-gutter { color: var(--color-text-muted); font-size: 0.75rem; }
        .rbc-time-slot { border-color: var(--color-border); }
        .rbc-agenda-table { color: var(--color-text); }
        .rbc-agenda-date-cell, .rbc-agenda-time-cell { color: var(--color-text-muted); font-size: 0.82rem; }
        .rbc-agenda-event-cell { font-size: 0.88rem; }
        .rbc-slot-selection { background: rgba(108,99,255,0.15); }
        .rbc-selected { box-shadow: 0 0 0 2px var(--color-primary); }
        @keyframes slideInDrawer { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '1.5rem 1.25rem' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
              📅 My Calendar
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '0.2rem 0 0' }}>
              Gigs, deliveries, events & reminders — all in one place
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {googleConnected ? (
              <>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{syncedLabel}</span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing…' : '🔄 Sync now'}
                </button>
              </>
            ) : (
              <button
                className="btn btn-outline btn-sm"
                onClick={handleGoogleConnect}
                style={{ borderColor: '#38bdf8', color: '#38bdf8' }}
              >
                Connect Google Calendar
              </button>
            )}

            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setDrawerEvent(null); setNewStartDate(null); setCreating(true); setDrawerOpen(true) }}
            >
              + New
            </button>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push('/settings/calendar')}
              title="Calendar settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* ── Filter chips ── */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {ALL_SOURCE_TYPES.map(t => {
            const active = activeTypes.has(t)
            const color  = SOURCE_TYPE_COLORS[t]
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  display:         'inline-flex',
                  alignItems:      'center',
                  gap:             '0.3rem',
                  padding:         '0.25rem 0.75rem',
                  borderRadius:    '9999px',
                  border:          `1.5px solid ${active ? color : 'var(--color-border)'}`,
                  background:      active ? `${color}22` : 'transparent',
                  color:           active ? color : 'var(--color-text-muted)',
                  fontSize:        '0.78rem',
                  fontWeight:      700,
                  cursor:          'pointer',
                  transition:      'all 0.15s',
                  textTransform:   'uppercase',
                  letterSpacing:   '0.04em',
                }}
              >
                <span style={{
                  width:        8,
                  height:       8,
                  borderRadius: '50%',
                  background:   active ? color : 'var(--color-border)',
                  display:      'inline-block',
                  flexShrink:   0,
                }}/>
                {SOURCE_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>

        {/* ── Calendar ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}/>
            Loading your calendar…
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}
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
            } as Record<string, unknown>}
          />
        )}
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
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'success' ? 'success' : 'error'}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </div>
        </div>
      )}
    </div>
  )
}
