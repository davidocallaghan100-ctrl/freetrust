'use client'
import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ORG_TYPES = [
  'Social Enterprise', 'NGO / Charity', 'B Corp',
  'Cooperative', 'Community Interest', 'Impact Startup',
]

const SECTORS = [
  'Clean Tech', 'Finance', 'Education', 'Health', 'Food & Agri', 'Creative',
  'Supply Chain', 'Energy', 'Technology', 'Housing', 'Transport', 'Other',
]

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function orgInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'ORG'
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', padding: '2.5rem 1.5rem 4rem', paddingTop: 124 },
  inner: { maxWidth: 720, margin: '0 auto' },
  heading: { fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem' },
  sub: { color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 16, padding: '2rem', marginBottom: '1.5rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.4rem' },
  input: { width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', minHeight: 110, resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'system-ui' },
  select: { width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', cursor: 'pointer' },
  fieldRow: { marginBottom: '1.25rem' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' },
  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.6rem', marginTop: '0.5rem' },
  typeBtn: { padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, textAlign: 'left' as const },
  typeBtnActive: { border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 600 },
  submitBtn: { width: '100%', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '1rem', padding: '0.85rem', border: 'none', borderRadius: 10, cursor: 'pointer', marginTop: '0.5rem' },
  hint: { fontSize: '0.75rem', color: '#475569', marginTop: '0.3rem' },
  errorText: { color: '#f87171', fontSize: '0.82rem', marginTop: '0.4rem' },
}

export default function CreateOrganisationPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [sector, setSector] = useState('')
  const [tags, setTags] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const canSubmit = name.trim().length >= 2 && type && description.trim().length >= 20

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    if (!allowed.includes(file.type)) { setError('Please upload a JPG, PNG, WebP, or SVG image.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('Logo must be under 3MB.'); return }
    setError('')

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = e => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to Supabase storage
    setLogoUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      // 15-second timeout so it never hangs indefinitely
      const uploadPromise = supabase.storage
        .from('org-logos')
        .upload(path, file, { contentType: file.type, upsert: false })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out')), 15000)
      )

      const { error: uploadErr } = await Promise.race([uploadPromise, timeoutPromise])
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage.from('org-logos').getPublicUrl(path)
      setLogoUrl(publicUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(`Logo upload failed (${msg}) — you can still create the organisation without a logo.`)
      setLogoPreview('')
    } finally {
      setLogoUploading(false)
    }
  }

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
          name: name.trim(),
          slug: slugify(name.trim()),
          type,
          description: description.trim(),
          location: location.trim(),
          website: website.trim(),
          sector,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          logo_url: logoUrl || null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          setError('You must be signed in to create an organisation.')
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }

      setSuccess(true)
      const orgId = data.organisation?.slug || data.organisation?.id
      setTimeout(() => router.push(orgId ? `/organisation/${orgId}` : '/organisations'), 1200)
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
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Redirecting to your organisation page…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <style>{`
        .nc-input:focus { border-color: rgba(56,189,248,0.4) !important; }
        @media (max-width: 600px) { .org-grid2 { grid-template-columns: 1fr !important; } }
      `}</style>
      <div style={S.inner}>
        <button style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', padding: 0 }} onClick={() => router.push('/organisations')}>
          ← Back to Directory
        </button>
        <h1 style={S.heading}>Create an Organisation</h1>
        <p style={S.sub}>Add your organisation to the FreeTrust directory to connect with the community.</p>

        <form onSubmit={handleSubmit}>
          {/* Logo Upload */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Logo / Profile Picture</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              {/* Preview */}
              <div
                style={{ width: 80, height: 80, borderRadius: 16, background: logoPreview ? 'transparent' : 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(56,189,248,0.2)', cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  name ? orgInitials(name) : '🏢'
                )}
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  style={{ background: logoUploading ? 'rgba(56,189,248,0.3)' : 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', cursor: logoUploading ? 'wait' : 'pointer' }}
                >
                  {logoUploading ? '⏳ Uploading…' : logoPreview ? '📷 Change Logo' : '📷 Upload Logo'}
                </button>
                {logoPreview && (
                  <button type="button" onClick={() => { setLogoPreview(''); setLogoUrl('') }} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>Remove</button>
                )}
                <p style={{ ...S.hint, marginTop: '0.5rem' }}>JPG, PNG, WebP or SVG · max 3MB</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Basic Information</div>

            <div style={S.fieldRow}>
              <label style={S.label}>Organisation Name <span style={{ color: '#f87171' }}>*</span></label>
              <input className="nc-input" style={S.input} placeholder="e.g. GreenPath Labs" value={name} onChange={e => setName(e.target.value)} maxLength={120} required />
              {name && <p style={S.hint}>URL: <span style={{ color: '#38bdf8' }}>freetrust.co/organisation/{slugify(name)}</span></p>}
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>Organisation Type <span style={{ color: '#f87171' }}>*</span></label>
              <div style={S.typeGrid}>
                {ORG_TYPES.map(t => (
                  <button key={t} type="button" style={{ ...S.typeBtn, ...(type === t ? S.typeBtnActive : {}) }} onClick={() => setType(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>Description <span style={{ color: '#f87171' }}>*</span></label>
              <textarea className="nc-input" style={S.textarea} placeholder="What does your organisation do? What's your mission and impact?" value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} required />
              <p style={S.hint}>{description.length}/1000 characters (min 20)</p>
            </div>

            <div className="org-grid2" style={S.grid2}>
              <div>
                <label style={S.label}>Location</label>
                <input className="nc-input" style={S.input} placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} maxLength={100} />
              </div>
              <div>
                <label style={S.label}>Sector</label>
                <select className="nc-input" style={S.select} value={sector} onChange={e => setSector(e.target.value)}>
                  <option value="">Select sector…</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>Website</label>
              <input className="nc-input" style={S.input} placeholder="https://yourorganisation.org" value={website} onChange={e => setWebsite(e.target.value)} type="url" maxLength={300} />
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>Tags</label>
              <input className="nc-input" style={S.input} placeholder="e.g. CleanTech, AI, Sustainability (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} maxLength={300} />
              <p style={S.hint}>Comma-separated — helps people find your organisation</p>
            </div>
          </div>

          {error && <p style={S.errorText}>⚠ {error}</p>}

          <button
            type="submit"
            style={{ ...S.submitBtn, opacity: (!canSubmit || submitting) ? 0.5 : 1, cursor: (!canSubmit || submitting) ? 'not-allowed' : 'pointer' }}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Creating…' : '🏢 Create Organisation'}
          </button>
        </form>
      </div>
    </div>
  )
}
