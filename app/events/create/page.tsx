'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Business', 'Technology', 'Health & Wellness', 'Arts & Culture', 'Education', 'Sports', 'Community', 'Music', 'Food & Drink', 'Other']
const TIMEZONES = ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney']

export default function CreateEventPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    mode: 'in-person' as 'in-person' | 'online' | 'hybrid',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: 'UTC',
    venue: '',
    address: '',
    city: '',
    country: '',
    onlineLink: '',
    maxAttendees: '',
    isFree: true,
    ticketPrice: '',
    coverImage: '',
    visibility: 'public' as 'public' | 'private',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }))

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1e293b', border: '1px solid #334155',
    borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
    color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8',
    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  const sectionStyle: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: '14px',
    padding: '20px', marginBottom: '16px',
  }

  const toggleBtn = (active: boolean, label: string, icon: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 0', borderRadius: '10px', border: 'none',
        cursor: 'pointer', fontSize: '13px', fontWeight: active ? 700 : 400,
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '6px', transition: 'all 0.15s',
        background: active ? '#38bdf8' : 'rgba(56,189,248,0.06)',
        color: active ? '#0f172a' : '#64748b',
      }}
    >
      {icon} {label}
    </button>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) { setError('Event title is required'); return }
    if (!form.startDate || !form.startTime) { setError('Start date and time are required'); return }
    if (!form.isFree && (!form.ticketPrice || Number(form.ticketPrice) <= 0)) {
      setError('Please enter a valid ticket price for paid events'); return
    }

    setSaving(true)
    try {
      const tickets = form.isFree
        ? [{ id: '1', name: 'Free Ticket', price: 0, free: true, quantity: Number(form.maxAttendees) || 100, description: '' }]
        : [{ id: '1', name: 'General Admission', price: Number(form.ticketPrice), free: false, quantity: Number(form.maxAttendees) || 100, description: '' }]

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tickets,
          organiserName: null,
          organiserBio: null,
          tags: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push(`/events/${data.event.id}`)
    } catch {
      setError('Failed to create event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '8px 12px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>📅 Create Event</h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>Share what you're organising with the community</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Basic Info */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>✏️ Event Details</h2>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Title *</label>
              <input
                style={inputStyle}
                placeholder="Give your event a compelling name"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' } as React.CSSProperties}
                placeholder="What's this event about? Who should attend?"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                maxLength={2000}
              />
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select
                style={inputStyle}
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>🗓 Date & Time</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input type="date" style={inputStyle} value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Start Time *</label>
                <input type="time" style={inputStyle} value={form.startTime} onChange={e => set('startTime', e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>End Date</label>
                <input type="date" style={inputStyle} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <input type="time" style={inputStyle} value={form.endTime} onChange={e => set('endTime', e.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Timezone</label>
              <select style={inputStyle} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          {/* Location */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>📍 Location</h2>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: 'rgba(56,189,248,0.04)', padding: '4px', borderRadius: '12px', border: '1px solid #334155' }}>
              {toggleBtn(form.mode === 'in-person', 'In Person', '🏛', () => set('mode', 'in-person'))}
              {toggleBtn(form.mode === 'online',    'Online',    '💻', () => set('mode', 'online'))}
              {toggleBtn(form.mode === 'hybrid',    'Hybrid',    '🔀', () => set('mode', 'hybrid'))}
            </div>

            {(form.mode === 'in-person' || form.mode === 'hybrid') && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Venue Name</label>
                  <input style={inputStyle} placeholder="e.g. Conference Centre, Community Hall" value={form.venue} onChange={e => set('venue', e.target.value)} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Street Address</label>
                  <input style={inputStyle} placeholder="Street address" value={form.address} onChange={e => set('address', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: form.mode === 'hybrid' ? '16px' : '0' }}>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input style={inputStyle} placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input style={inputStyle} placeholder="Country" value={form.country} onChange={e => set('country', e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {(form.mode === 'online' || form.mode === 'hybrid') && (
              <div style={{ marginTop: form.mode === 'hybrid' ? '4px' : '0' }}>
                <label style={labelStyle}>Meeting Link</label>
                <input style={inputStyle} type="url" placeholder="https://zoom.us/... or https://meet.google.com/..." value={form.onlineLink} onChange={e => set('onlineLink', e.target.value)} />
              </div>
            )}
          </div>

          {/* Tickets & Capacity */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>🎟 Tickets & Capacity</h2>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: 'rgba(56,189,248,0.04)', padding: '4px', borderRadius: '12px', border: '1px solid #334155' }}>
              {toggleBtn(form.isFree,  'Free',    '🎁', () => set('isFree', true))}
              {toggleBtn(!form.isFree, 'Paid',    '💳', () => set('isFree', false))}
            </div>

            {!form.isFree && (
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Ticket Price (£)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.ticketPrice}
                  onChange={e => set('ticketPrice', e.target.value)}
                />
              </div>
            )}

            <div>
              <label style={labelStyle}>Max Attendees</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                placeholder="Leave blank for unlimited"
                value={form.maxAttendees}
                onChange={e => set('maxAttendees', e.target.value)}
              />
            </div>
          </div>

          {/* Visibility */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>👁 Visibility</h2>
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(56,189,248,0.04)', padding: '4px', borderRadius: '12px', border: '1px solid #334155' }}>
              {toggleBtn(form.visibility === 'public',  'Public',  '🌐', () => set('visibility', 'public'))}
              {toggleBtn(form.visibility === 'private', 'Private', '🔒', () => set('visibility', 'private'))}
            </div>
            <p style={{ fontSize: '11px', color: '#475569', margin: '8px 0 0' }}>
              {form.visibility === 'public' ? 'Visible to everyone on FreeTrust' : 'Only people with the link can see this event'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#f87171', fontSize: '13px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Trust earning note */}
          <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#38bdf8' }}>
            💎 You'll earn <strong>₮15 Trust</strong> for hosting this event
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: saving ? '#334155' : 'linear-gradient(135deg, #38bdf8, #818cf8)',
              color: saving ? '#64748b' : '#fff', fontSize: '15px', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {saving ? '⏳ Creating Event…' : '🚀 Publish Event'}
          </button>
        </form>
      </div>
    </div>
  )
}
