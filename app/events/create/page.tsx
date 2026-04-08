'use client'
import React, { useState } from 'react'
import Link from 'next/link'

type EventType = 'online' | 'in-person'
type TicketType = 'free' | 'paid'

interface FormState {
  title: string
  description: string
  category: string
  eventType: EventType
  ticketType: TicketType
  price: string
  capacity: string
  date: string
  startTime: string
  endTime: string
  locationName: string
  locationAddress: string
  meetingUrl: string
  tags: string
}

const categories = ['Conference', 'Webinar', 'Workshop', 'Meetup', 'Live Stream', 'Hackathon', 'Panel', 'Networking']

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '2rem 1.5rem' },
  heroInner: { maxWidth: 760, margin: '0 auto' },
  backLink: { color: '#64748b', fontSize: '0.83rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '1rem' },
  heroTitle: { fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' },
  heroSub: { color: '#64748b', fontSize: '0.9rem' },
  rewardBanner: { background: 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(245,158,11,0.04))', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginTop: '1rem', display: 'flex', gap: '0.6rem', alignItems: 'center' },
  rewardIcon: { fontSize: '1.2rem' },
  rewardText: { fontSize: '0.82rem', color: '#fbbf24' },
  form: { maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem' },
  section: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.25rem' },
  sectionTitle: { fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: '#f1f5f9' },
  fieldGroup: { marginBottom: '1.1rem' },
  label: { display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 500 },
  input: { width: '100%', background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.6rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' as const, outline: 'none' },
  textarea: { width: '100%', background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.6rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 100, outline: 'none' },
  select: { width: '100%', background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.6rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  toggleRow: { display: 'flex', gap: '0.75rem' },
  toggleBtn: { flex: 1, background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 9, padding: '0.7rem', fontSize: '0.85rem', color: '#94a3b8', cursor: 'pointer', fontWeight: 500, textAlign: 'center' as const },
  toggleBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem' },
  catBtn: { background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 8, padding: '0.55rem 0.4rem', fontSize: '0.78rem', color: '#94a3b8', cursor: 'pointer', textAlign: 'center' as const },
  catBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  submitRow: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, padding: '0.7rem 1.5rem', fontSize: '0.9rem', color: '#94a3b8', cursor: 'pointer' },
  submitBtn: { background: '#38bdf8', border: 'none', borderRadius: 10, padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
  successCard: { background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 14, padding: '2.5rem', textAlign: 'center' as const, maxWidth: 480, margin: '4rem auto' },
  successIcon: { fontSize: '3rem', marginBottom: '1rem' },
  successTitle: { fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' },
  successSub: { color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' },
  successReward: { background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#fbbf24' },
  viewBtn: { background: '#38bdf8', border: 'none', borderRadius: 10, padding: '0.7rem 1.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
}

export default function CreateEventPage() {
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    category: '',
    eventType: 'online',
    ticketType: 'free',
    price: '',
    capacity: '',
    date: '',
    startTime: '',
    endTime: '',
    locationName: '',
    locationAddress: '',
    meetingUrl: '',
    tags: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.date || !form.category) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={S.page}>
        <div style={{ ...S.form, display: 'flex', justifyContent: 'center' }}>
          <div style={S.successCard}>
            <div style={S.successIcon}>🎉</div>
            <div style={S.successTitle}>Event Created!</div>
            <div style={S.successSub}>{form.title} has been published to the FreeTrust community.</div>
            <div style={S.successReward}>
              ₮ +15 Trust Tokens earned for hosting a community event!
            </div>
            <Link href="/events">
              <button style={S.viewBtn}>View All Events →</button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <Link href="/events" style={S.backLink}>← Back to Events</Link>
          <h1 style={S.heroTitle}>Host an Event</h1>
          <p style={S.heroSub}>Share your knowledge and grow your reputation in the FreeTrust community.</p>
          <div style={S.rewardBanner}>
            <span style={S.rewardIcon}>₮</span>
            <span style={S.rewardText}>
              <strong>Earn ₮15 Trust Tokens</strong> for hosting a community event — rewarded when your first attendee registers.
            </span>
          </div>
        </div>
      </div>

      <form style={S.form} onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📋 Event Details</div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Event Title *</label>
            <input style={S.input} value={form.title} onChange={set('title')} placeholder="e.g. FreeTrust Founder Summit 2025" required />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Description</label>
            <textarea style={S.textarea} value={form.description} onChange={set('description')} placeholder="Tell attendees what to expect..." />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Category *</label>
            <div style={S.categoryGrid}>
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: c }))}
                  style={{ ...S.catBtn, ...(form.category === c ? S.catBtnActive : {}) }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📅 Date & Time</div>
          <div style={S.row2}>
            <div style={S.fieldGroup}>
              <label style={S.label}>Date *</label>
              <input style={S.input} type="date" value={form.date} onChange={set('date')} required />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Capacity</label>
              <input style={S.input} type="number" value={form.capacity} onChange={set('capacity')} placeholder="e.g. 100" min="1" />
            </div>
          </div>
          <div style={S.row2}>
            <div style={S.fieldGroup}>
              <label style={S.label}>Start Time</label>
              <input style={S.input} type="time" value={form.startTime} onChange={set('startTime')} />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>End Time</label>
              <input style={S.input} type="time" value={form.endTime} onChange={set('endTime')} />
            </div>
          </div>
        </div>

        {/* Location */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📍 Location</div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Event Type</label>
            <div style={S.toggleRow}>
              <button type="button" onClick={() => setForm(f => ({ ...f, eventType: 'online' }))} style={{ ...S.toggleBtn, ...(form.eventType === 'online' ? S.toggleBtnActive : {}) }}>🌐 Online</button>
              <button type="button" onClick={() => setForm(f => ({ ...f, eventType: 'in-person' }))} style={{ ...S.toggleBtn, ...(form.eventType === 'in-person' ? S.toggleBtnActive : {}) }}>📍 In Person</button>
            </div>
          </div>
          {form.eventType === 'online' ? (
            <div style={S.fieldGroup}>
              <label style={S.label}>Meeting URL</label>
              <input style={S.input} value={form.meetingUrl} onChange={set('meetingUrl')} placeholder="https://zoom.us/j/..." />
            </div>
          ) : (
            <>
              <div style={S.fieldGroup}>
                <label style={S.label}>Venue Name</label>
                <input style={S.input} value={form.locationName} onChange={set('locationName')} placeholder="e.g. The Brewery" />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Address</label>
                <input style={S.input} value={form.locationAddress} onChange={set('locationAddress')} placeholder="e.g. Chiswell Street, London EC1Y 4SD" />
              </div>
            </>
          )}
        </div>

        {/* Tickets */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🎟️ Tickets</div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Ticket Type</label>
            <div style={S.toggleRow}>
              <button type="button" onClick={() => setForm(f => ({ ...f, ticketType: 'free' }))} style={{ ...S.toggleBtn, ...(form.ticketType === 'free' ? S.toggleBtnActive : {}) }}>✓ Free</button>
              <button type="button" onClick={() => setForm(f => ({ ...f, ticketType: 'paid' }))} style={{ ...S.toggleBtn, ...(form.ticketType === 'paid' ? S.toggleBtnActive : {}) }}>💳 Paid</button>
            </div>
          </div>
          {form.ticketType === 'paid' && (
            <div style={S.fieldGroup}>
              <label style={S.label}>Price (£)</label>
              <input style={S.input} type="number" value={form.price} onChange={set('price')} placeholder="e.g. 25" min="1" step="0.01" />
            </div>
          )}
        </div>

        {/* Tags */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🏷️ Tags</div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Tags (comma-separated)</label>
            <input style={S.input} value={form.tags} onChange={set('tags')} placeholder="e.g. Founders, Networking, Startup" />
          </div>
        </div>

        <div style={S.submitRow}>
          <Link href="/events">
            <button type="button" style={S.cancelBtn}>Cancel</button>
          </Link>
          <button type="submit" style={S.submitBtn}>Publish Event →</button>
        </div>
      </form>
    </div>
  )
}
