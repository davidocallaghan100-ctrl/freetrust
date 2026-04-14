'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compression'

type OrgForm = {
  name: string
  tagline: string
  description: string
  website: string
  location: string
  sector: string
  founded_year: string
  impact_statement: string
  tags: string
}

export default function EditOrgPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notAllowed, setNotAllowed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')

  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<OrgForm>({
    name: '', tagline: '', description: '', website: '',
    location: '', sector: '', founded_year: '', impact_statement: '', tags: '',
  })

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setNotAllowed(true); setLoading(false); return }

      const { data: org } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', id)
        .single()

      if (!org) { setNotAllowed(true); setLoading(false); return }

      // Check if user is creator or admin member
      const isCreator = org.creator_id === user.id
      if (!isCreator) {
        const { data: membership } = await supabase
          .from('organisation_members')
          .select('role')
          .eq('organisation_id', id)
          .eq('user_id', user.id)
          .single()
        if (!membership || !['admin', 'owner'].includes(membership.role)) {
          setNotAllowed(true); setLoading(false); return
        }
      }

      setLogoUrl(org.logo_url || '')
      setCoverUrl(org.cover_url || '')
      setForm({
        name: org.name || '',
        tagline: org.tagline || '',
        description: org.description || '',
        website: org.website || '',
        location: org.location || '',
        sector: org.sector || '',
        founded_year: org.founded_year?.toString() || '',
        impact_statement: org.impact_statement || '',
        tags: (org.tags || []).join(', '),
      })
      setLoading(false)
    }
    load()
  }, [id])

  function set(field: keyof OrgForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setUploadingLogo(true)
    try {
      // Org logo compression — 1 MB cap since logos display small.
      const file = await compressImage(rawFile, 1)
      const ext = file.name.split('.').pop()
      const path = `${id}-logo.${ext}`
      await supabase.storage.from('org-logos').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('org-logos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    } catch { setError('Logo upload failed') }
    finally { setUploadingLogo(false); if (logoInputRef.current) logoInputRef.current.value = '' }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setUploadingCover(true)
    try {
      // Cover photo compression — 2 MB cap (larger render area than logo).
      const file = await compressImage(rawFile, 2)
      const ext = file.name.split('.').pop()
      const path = `orgs/${id}-cover.${ext}`
      await supabase.storage.from('covers').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      setCoverUrl(data.publicUrl)
    } catch { setError('Cover upload failed') }
    finally { setUploadingCover(false); if (coverInputRef.current) coverInputRef.current.value = '' }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Organisation name is required'); return }
    setSaving(true); setError(null)

    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { error: saveErr } = await supabase.from('organisations').update({
      name: form.name.trim(),
      tagline: form.tagline.trim() || null,
      description: form.description.trim() || null,
      website: form.website.trim() || null,
      location: form.location.trim() || null,
      sector: form.sector.trim() || null,
      founded_year: form.founded_year ? parseInt(form.founded_year) : null,
      impact_statement: form.impact_statement.trim() || null,
      tags,
      logo_url: logoUrl || null,
      cover_url: coverUrl || null,
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
          <p style={{ color: muted, marginBottom: '1.5rem' }}>Only the organisation creator or admin can edit this.</p>
          <button onClick={() => router.back()} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '0.65rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>Go back</button>
        </div>
      </main>
    )
  }

  return (
    <main className="ft-page-content" style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingBottom: 100 }}>
      <style>{`input:focus, textarea:focus, select:focus { border-color: ${accent} !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }`}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => router.back()} style={{ background: '#1f2937', border: `1px solid ${border}`, borderRadius: 10, padding: '0.5rem 1rem', color: text, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Edit organisation</h1>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {/* Cover photo */}
        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 1rem', color: text }}>🖼 Cover &amp; Logo</h3>

          {/* Cover preview */}
          {coverUrl && (
            <div style={{ borderRadius: 10, overflow: 'hidden', height: 140, marginBottom: '0.75rem', border: `1px solid ${border}` }}>
              <img src={coverUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
          <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
            style={{ background: 'rgba(139,92,246,0.1)', border: `1.5px dashed ${border}`, borderRadius: 10, padding: '0.65rem 1rem', color: uploadingCover ? muted : accent, fontSize: '0.82rem', fontWeight: 600, cursor: uploadingCover ? 'wait' : 'pointer', width: '100%', marginBottom: '1rem' }}>
            {uploadingCover ? '⏳ Uploading…' : '📷 Upload cover photo'}
          </button>

          {/* Logo preview */}
          {logoUrl && (
            <div style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', marginBottom: '0.75rem', border: `1px solid ${border}` }}>
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
          <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
            style={{ background: 'rgba(139,92,246,0.1)', border: `1.5px dashed ${border}`, borderRadius: 10, padding: '0.65rem 1rem', color: uploadingLogo ? muted : accent, fontSize: '0.82rem', fontWeight: 600, cursor: uploadingLogo ? 'wait' : 'pointer', width: '100%' }}>
            {uploadingLogo ? '⏳ Uploading…' : '🏷 Upload logo'}
          </button>
        </section>

        {/* Core details */}
        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: text }}>📋 Profile</h3>

          <div>
            <label style={labelStyle}>Organisation name *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Organisation name" maxLength={100} />
          </div>
          <div>
            <label style={labelStyle}>Tagline</label>
            <input style={inputStyle} value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Short one-liner about what you do" maxLength={160} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Tell people about your organisation…" maxLength={2000} />
          </div>
          <div>
            <label style={labelStyle}>Impact statement</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.impact_statement} onChange={e => set('impact_statement', e.target.value)} placeholder="What positive impact do you create?" maxLength={500} />
          </div>
        </section>

        {/* Info */}
        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: text }}>ℹ️ Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Cork, Ireland" maxLength={100} />
            </div>
            <div>
              <label style={labelStyle}>Sector</label>
              <input style={inputStyle} value={form.sector} onChange={e => set('sector', e.target.value)} placeholder="e.g. Technology" maxLength={80} />
            </div>
            <div>
              <label style={labelStyle}>Founded year</label>
              <input style={inputStyle} type="number" min="1800" max="2099" value={form.founded_year} onChange={e => set('founded_year', e.target.value)} placeholder="e.g. 2024" />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://…" maxLength={200} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tags <span style={{ fontWeight: 400, color: muted }}>(comma-separated)</span></label>
            <input style={inputStyle} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. AI, SaaS, sustainability" />
          </div>
        </section>

        {/* Save */}
        <button onClick={handleSave} disabled={saving || saved}
          style={{ width: '100%', background: saved ? 'rgba(52,211,153,0.2)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: saved ? '#34d399' : '#fff', border: saved ? '1.5px solid rgba(52,211,153,0.4)' : 'none', borderRadius: 12, padding: '1rem', fontWeight: 800, fontSize: '1rem', cursor: saving || saved ? 'default' : 'pointer', boxShadow: saved ? 'none' : '0 4px 20px rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? '💾 Saving…' : saved ? '✓ Saved!' : 'Save changes'}
        </button>
      </div>
    </main>
  )
}
