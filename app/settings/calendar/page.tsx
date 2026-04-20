'use client'
// ============================================================================
// FreeTrust — /settings/calendar
// Google Calendar sync preferences + disconnect.
// ============================================================================
import { useEffect, useState, useCallback } from 'react'
import { useRouter }                        from 'next/navigation'

interface SyncSettings {
  connected:         boolean
  sync_ft_to_google: boolean
  sync_google_to_ft: boolean
  synced_at:         string | null
}

export default function CalendarSettingsPage() {
  const router = useRouter()

  const [settings,      setSettings]      = useState<SyncSettings | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success'|'error' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res  = await fetch('/api/calendar/google/settings')
      const data = await res.json() as SyncSettings
      setSettings(data)
    } catch { showToast('Failed to load settings', 'error') }
    finally   { setLoading(false) }
  }

  useEffect(() => { fetchSettings() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(key: 'sync_ft_to_google' | 'sync_google_to_ft') {
    if (!settings) return
    setSaving(true)
    const next = !settings[key]
    try {
      const res = await fetch('/api/calendar/google/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [key]: next }),
      })
      if (!res.ok) throw new Error()
      setSettings(prev => prev ? { ...prev, [key]: next } : prev)
      showToast('Setting saved', 'success')
    } catch { showToast('Failed to save', 'error') }
    finally   { setSaving(false) }
  }

  async function handleConnect() {
    const res = await fetch('/api/calendar/google/connect', { method: 'POST' })
    if (!res.ok) { showToast('Failed to start Google auth', 'error'); return }
    const { url } = await res.json()
    window.location.href = url
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Calendar? Google-imported events will be removed from your FreeTrust calendar.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/calendar/google/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error()
      await fetchSettings()
      showToast('Google Calendar disconnected', 'success')
    } catch { showToast('Failed to disconnect', 'error') }
    finally   { setDisconnecting(false) }
  }

  if (loading) {
    return (
      <div className="ft-page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner"/>
      </div>
    )
  }

  return (
    <div className="ft-page-content">
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.25rem' }}>

        {/* Back link */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.back()}
          style={{ marginBottom: '1.5rem' }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.4rem' }}>
          Calendar Settings
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Manage your Google Calendar sync preferences.
        </p>

        {/* ── Google Connection Card ── */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{
              width:        40,
              height:       40,
              borderRadius: '50%',
              background:   'rgba(56,189,248,0.12)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontSize:     '1.2rem',
              flexShrink:   0,
            }}>
              📅
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem' }}>
                Google Calendar
              </div>
              <div style={{ fontSize: '0.82rem', color: settings?.connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {settings?.connected
                  ? settings.synced_at
                    ? `Connected · Last synced ${new Date(settings.synced_at).toLocaleString('en-IE')}`
                    : 'Connected · Never synced'
                  : 'Not connected'
                }
              </div>
            </div>

            {settings?.connected ? (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <button
                className="btn btn-outline btn-sm"
                onClick={handleConnect}
                style={{ borderColor: '#38bdf8', color: '#38bdf8' }}
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* ── Sync Preference Toggles ── */}
        {settings?.connected && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Sync preferences
            </h3>

            {/* Toggle: push FreeTrust → Google */}
            <ToggleRow
              title="Sync FreeTrust activity → Google Calendar"
              description="Automatically push your gigs, bookings, and hosted events to your Google Calendar."
              checked={settings.sync_ft_to_google}
              disabled={saving}
              onChange={() => handleToggle('sync_ft_to_google')}
            />

            {/* Toggle: pull Google → FreeTrust */}
            <ToggleRow
              title="Import Google Calendar events → FreeTrust"
              description="Pull your Google Calendar events into your FreeTrust calendar view."
              checked={settings.sync_google_to_ft}
              disabled={saving}
              onChange={() => handleToggle('sync_google_to_ft')}
            />

            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', margin: 0 }}>
              Changes take effect on the next sync. You can trigger a manual sync from the calendar page.
            </p>
          </div>
        )}

        {/* ── Info box when not connected ── */}
        {!settings?.connected && (
          <div style={{
            background:   'rgba(56,189,248,0.07)',
            border:       '1px solid rgba(56,189,248,0.2)',
            borderRadius: 'var(--radius-md)',
            padding:      '1.25rem',
          }}>
            <h4 style={{ color: 'var(--color-text)', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.95rem' }}>
              What you get with Google Calendar sync
            </h4>
            <ul style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.8, paddingLeft: '1rem' }}>
              <li>Gig deadlines appear automatically in Google Calendar</li>
              <li>Booked services and product delivery dates sync both ways</li>
              <li>FreeTrust events you host show up on your phone calendar</li>
              <li>Google Calendar events appear in your FreeTrust view</li>
            </ul>
          </div>
        )}
      </div>

      {/* Toast */}
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

// ── Toggle row component ──────────────────────────────────────────────────────
function ToggleRow({
  title, description, checked, disabled, onChange,
}: {
  title:       string
  description: string
  checked:     boolean
  disabled:    boolean
  onChange:    () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        style={{
          flexShrink:      0,
          width:           44,
          height:          24,
          borderRadius:    12,
          background:      checked ? 'var(--color-primary)' : 'var(--color-border)',
          border:          'none',
          cursor:          disabled ? 'not-allowed' : 'pointer',
          position:        'relative',
          transition:      'background 0.2s',
          opacity:         disabled ? 0.5 : 1,
        }}
      >
        <span style={{
          position:     'absolute',
          top:          2,
          left:         checked ? 22 : 2,
          width:        20,
          height:       20,
          borderRadius: '50%',
          background:   '#fff',
          transition:   'left 0.2s',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.25)',
        }}/>
      </button>
    </div>
  )
}
