'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EventForm = {
  title: string
  description: string
  starts_at: string
  ends_at: string
  is_online: boolean
  meeting_url: string
}

export default function EditEventPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notAllowed, setNotAllowed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [communityId, setCommunityId] = useState<string | null>(null)

  const [form, setForm] = useState<EventForm>({
    title: '', description: '', starts_at: '', ends_at: '', is_online: true, meeting_url: '',
  })

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setNotAllowed(true); setLoading(false); return }

      const { data: evt } = await supabase
        .from('community_events')
        .select('*')
        .eq('id', id)
        .single()

      if (!evt) { setNotAllowed(true); setLoading(false); return }

      // Check if user is community owner/admin
      if (evt.community_id) {
        const { data: community } = await supabase
          .from('communities')
          .select('owner_id')
          .eq('id', evt.community_id)
          .single()

        const { data: membership } = await supabase
          .from('community_members')
          .select('role')
          .eq('community_id', evt.community_id)
          .eq('user_id', user.id)
          .single()

        const isCommunityOwner = community?.owner_id === user.id
        const isAdmin = membership?.role === 'admin' || membership?.role === 'moderator'
        if (!isCommunityOwner && !isAdmin) { setNotAllowed(true); setLoading(false); return }
      } else {
        setNotAllowed(true); setLoading(false); return
      }

      setCommunityId(evt.community_id)

      // Format dates for datetime-local input
      const toLocalInput = (iso: string) => {
        const d = new Date(iso)
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      }

      setForm({
        title: evt.title || '',
        description: evt.description || '',
        starts_at: evt.starts_at ? toLocalInput(evt.starts_at) : '',
        ends_at: evt.ends_at ? toLocalInput(evt.ends_at) : '',
        is_online: evt.is_online ?? true,
        meeting_url: evt.meeting_url || '',
      })
      setLoading(false)
    }
    load()
  }, [id])

  function set<K extends keyof EventForm>(field: K, value: EventForm[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.starts_at) { setError('Start time is required'); return }
    setSaving(true); setError(null)

    const { error: saveErr } = await supabase.from('community_events').update({
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_online: form.is_online,
      meeting_url: form.is_online ? (form.meeting_url.trim() || null) : null,
    }).eq('id', id)

    setSaving(false)
    if (saveErr) { setError(saveErr.message); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); router.back() }, 1200)
  }

  // ─── Theme ─────────────────────────────────────────────────────────────────
  const bg = '#030712'
  const card = '#111827'
  const border = 'rgba(139,92,246,0.2)'
  const accent = '#8b5cf6'
  const text = '#f1f5f9'
  const muted = '#64748b'
  const inputStyle = {
    width: '100%', background: '#1f2937', border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: 10, padding: '0.75rem 1rem', color: text, fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6, display: 'block' as const }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: muted, fontSize: '0.85rem' }}>Loading…</p>
        </div>
      </main>
    )
  }

  if (notAllowed) {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontWeight: 800, margin: '0 0 0.5rem' }}>Not authorised</h2>
          <p style={{ color: muted, marginBottom: '1.5rem' }}>Only community admins can edit events.</p>
          <button onClick={() => router.back()} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '0.65rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>Go back</button>
        </div>
      </main>
    )
  }

  return (
    <main className="ft-page-content" style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingBottom: 100 }}>
      <style>{`input:focus, textarea:focus, select:focus { border-color: ${accent} !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }`}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 1.25rem' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => router.back()} style={{ background: '#1f2937', border: `1px solid ${border}`, borderRadius: 10, padding: '0.5rem 1rem', color: text, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Edit event</h1>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Event title *</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Event title" maxLength={150} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What's this event about?" maxLength={2000} />
          </div>
        </section>

        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: text }}>📅 Date &amp; Time</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Starts *</label>
              <input style={inputStyle} type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Ends</label>
              <input style={inputStyle} type="datetime-local" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} />
            </div>
          </div>
        </section>

        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: text }}>📍 Location</h3>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {[{ label: '💻 Online', val: true }, { label: '📍 In Person', val: false }].map(({ label, val }) => (
              <button key={label} onClick={() => set('is_online', val)}
                style={{ flex: 1, padding: '0.65rem', borderRadius: 10, border: `1.5px solid ${form.is_online === val ? accent : border}`, background: form.is_online === val ? 'rgba(139,92,246,0.12)' : '#1f2937', color: form.is_online === val ? accent : '#94a3b8', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {form.is_online && (
            <div>
              <label style={labelStyle}>Meeting link</label>
              <input style={inputStyle} value={form.meeting_url} onChange={e => set('meeting_url', e.target.value)} placeholder="https://meet.google.com/…" maxLength={300} />
            </div>
          )}
        </section>

        <button onClick={handleSave} disabled={saving || saved}
          style={{ width: '100%', background: saved ? 'rgba(52,211,153,0.2)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: saved ? '#34d399' : '#fff', border: saved ? '1.5px solid rgba(52,211,153,0.4)' : 'none', borderRadius: 12, padding: '1rem', fontWeight: 800, fontSize: '1rem', cursor: saving || saved ? 'default' : 'pointer', boxShadow: saved ? 'none' : '0 4px 20px rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? '💾 Saving…' : saved ? '✓ Saved!' : 'Save changes'}
        </button>
      </div>
    </main>
  )
}
