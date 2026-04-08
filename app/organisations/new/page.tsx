'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

const ORG_TYPES = [
  'Social Enterprise',
  'NGO / Charity',
  'B Corp',
  'Cooperative',
  'Community Interest',
  'Impact Startup',
]

const SECTORS = [
  'Clean Tech', 'Finance', 'Education', 'Health', 'Food & Agri', 'Creative',
  'Supply Chain', 'Energy', 'Technology', 'Housing', 'Transport', 'Other',
]

interface FormState {
  name: string
  type: string
  description: string
  location: string
  website: string
  sector: string
  tags: string
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', padding: '2.5rem 1.5rem 4rem' },
  inner: { maxWidth: 720, margin: '0 auto' },
  heading: { fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem' },
  sub: { color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 16, padding: '2rem' },
  label: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' },
  input: { width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', minHeight: 110, resize: 'vertical', boxSizing: 'border-box' },
  select: { width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', cursor: 'pointer' },
  fieldRow: { marginBottom: '1.25rem' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' },
  submitBtn: { width: '100%', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '1rem', padding: '0.85rem', border: 'none', borderRadius: 10, cursor: 'pointer', marginTop: '0.5rem' },
  disabledBtn: { opacity: 0.5, cursor: 'not-allowed' },
  errorText: { color: '#f87171', fontSize: '0.82rem', marginTop: '0.4rem' },
  hint: { fontSize: '0.75rem', color: '#475569', marginTop: '0.3rem' },
  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.6rem', marginTop: '0.5rem' },
  typeBtn: { padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, textAlign: 'left' as const },
  typeBtnActive: { border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 600 },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1.5rem', cursor: 'pointer', background: 'none', border: 'none' },
}

export default function CreateOrganisationPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    name: '', type: '', description: '', location: '', website: '', sector: '', tags: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const canSubmit = form.name.trim().length >= 2 && form.type && form.description.trim().length >= 20

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/organisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim(),
          location: form.location.trim(),
          website: form.website.trim(),
          sector: form.sector,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setError('You must be signed in to create an organisation.')
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/organisations'), 1200)
    } catch {
      setError('Network error — please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Organisation Created!</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Redirecting you to the directory…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <button style={S.backLink} onClick={() => router.push('/organisations')}>
          ← Back to Directory
        </button>
        <h1 style={S.heading}>Create an Organisation</h1>
        <p style={S.sub}>Add your organisation to the FreeTrust directory to connect with the community.</p>

        <form style={S.card} onSubmit={handleSubmit}>
          {/* Name */}
          <div style={S.fieldRow}>
            <label style={S.label}>Organisation Name <span style={{ color: '#f87171' }}>*</span></label>
            <input
              style={S.input}
              placeholder="e.g. GreenPath Labs"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              maxLength={120}
              required
            />
          </div>

          {/* Type */}
          <div style={S.fieldRow}>
            <label style={S.label}>Organisation Type <span style={{ color: '#f87171' }}>*</span></label>
            <div style={S.typeGrid}>
              {ORG_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  style={{ ...S.typeBtn, ...(form.type === t ? S.typeBtnActive : {}) }}
                  onClick={() => set('type', t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={S.fieldRow}>
            <label style={S.label}>Description <span style={{ color: '#f87171' }}>*</span></label>
            <textarea
              style={S.textarea}
              placeholder="What does your organisation do? What's your mission and impact?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              maxLength={1000}
              required
            />
            <p style={S.hint}>{form.description.length}/1000 characters (min 20)</p>
          </div>

          {/* Location + Sector */}
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Location</label>
              <input
                style={S.input}
                placeholder="e.g. London, UK"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label style={S.label}>Sector</label>
              <select
                style={S.select}
                value={form.sector}
                onChange={e => set('sector', e.target.value)}
              >
                <option value="">Select sector…</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Website */}
          <div style={S.fieldRow}>
            <label style={S.label}>Website</label>
            <input
              style={S.input}
              placeholder="https://yourorganisation.org"
              value={form.website}
              onChange={e => set('website', e.target.value)}
              type="url"
              maxLength={300}
            />
          </div>

          {/* Tags */}
          <div style={S.fieldRow}>
            <label style={S.label}>Tags</label>
            <input
              style={S.input}
              placeholder="e.g. CleanTech, AI, Sustainability (comma-separated)"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
              maxLength={300}
            />
            <p style={S.hint}>Comma-separated tags to help people find your organisation</p>
          </div>

          {error && <p style={S.errorText}>⚠ {error}</p>}

          <button
            type="submit"
            style={{ ...S.submitBtn, ...((!canSubmit || submitting) ? S.disabledBtn : {}) }}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Creating…' : 'Create Organisation'}
          </button>
        </form>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .org-grid2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
