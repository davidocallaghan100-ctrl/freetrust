'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compression'
import type { InvestmentIntent, FundingStage } from '@/types/organisation'

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

type InvestmentForm = {
  isSeekingInvestment: boolean
  visibility: 'public' | 'private'
  sharedWithESG: boolean
  amountRaising: string
  currency: string
  fundingStage: '' | FundingStage
  useOfFunds: string
  currentTraction: string
  expectedCloseDate: string
  pitchDeckUrl: string
  existingInvestors: string
}

const DEFAULT_INVESTMENT: InvestmentForm = {
  isSeekingInvestment: false,
  visibility: 'private',
  sharedWithESG: false,
  amountRaising: '',
  currency: '€',
  fundingStage: '',
  useOfFunds: '',
  currentTraction: '',
  expectedCloseDate: '',
  pitchDeckUrl: '',
  existingInvestors: '',
}

function intentToForm(intent: InvestmentIntent | null | undefined): InvestmentForm {
  if (!intent) return DEFAULT_INVESTMENT
  const d = intent.investmentDetails ?? {}
  return {
    isSeekingInvestment: intent.isSeekingInvestment,
    visibility: intent.visibility ?? 'private',
    sharedWithESG: intent.sharedWithESG ?? false,
    amountRaising: d.amountRaising != null ? String(d.amountRaising) : '',
    currency: d.currency ?? '€',
    fundingStage: d.fundingStage ?? '',
    useOfFunds: d.useOfFunds ?? '',
    currentTraction: d.currentTraction ?? '',
    expectedCloseDate: d.expectedCloseDate ?? '',
    pitchDeckUrl: d.pitchDeckUrl ?? '',
    existingInvestors: d.existingInvestors ?? '',
  }
}

export default function EditOrgPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  // Stable Supabase client — created once on mount to avoid infinite re-render loops
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

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

  const [investment, setInvestment] = useState<InvestmentForm>(DEFAULT_INVESTMENT)

  useEffect(() => {
    if (!id) return
    const timer = setTimeout(() => setLoading(false), 10000)
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setNotAllowed(true); return }

        // Fetch the organisation
        const { data: org } = await supabase
          .from('organisations')
          .select('*')
          .eq('id', id)
          .single()

        if (!org) { setNotAllowed(true); return }

        // Fetch the caller's profile to check for platform admin role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const isPlatformAdmin = (profile as { role?: string } | null)?.role === 'admin'
        const isCreator = org.creator_id === user.id

        // Check org membership role (org-level admin/owner)
        let isOrgAdmin = false
        if (!isCreator && !isPlatformAdmin) {
          const { data: membership } = await supabase
            .from('organisation_members')
            .select('role')
            .eq('organisation_id', id)
            .eq('user_id', user.id)
            .single()
          isOrgAdmin = membership != null && ['admin', 'owner'].includes((membership as { role: string }).role)
        }

        if (!isCreator && !isPlatformAdmin && !isOrgAdmin) {
          setNotAllowed(true); return
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

        // Load existing investment intent if present
        const existingIntent = org.investment_intent as InvestmentIntent | null | undefined
        setInvestment(intentToForm(existingIntent))
      } catch (err) {
        console.error('[org-edit] load error:', err)
        setError('Could not load organisation. Please try again.')
      } finally {
        clearTimeout(timer)
        setLoading(false)
      }
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof OrgForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function setInv<K extends keyof InvestmentForm>(field: K, value: InvestmentForm[K]) {
    setInvestment(s => ({ ...s, [field]: value }))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setUploadingLogo(true)
    setError(null)
    try {
      // Compress before upload — 1 MB cap since logos display small.
      const file = await compressImage(rawFile, 1)
      const formData = new FormData()
      formData.append('file', file)
      // Route through API (admin client) to bypass storage RLS
      const res = await fetch('/api/organisations/upload-logo', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Logo upload failed')
      setLogoUrl(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setUploadingCover(true)
    setError(null)
    try {
      // Compress before upload — 2 MB cap (larger render area than logo).
      const file = await compressImage(rawFile, 2)
      const formData = new FormData()
      formData.append('file', file)
      // Route through API (admin client) to bypass storage RLS
      const res = await fetch('/api/upload/org-cover', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Cover upload failed')
      setCoverUrl(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover upload failed')
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Organisation name is required'); return }
    setSaving(true); setError(null)

    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)

    // Build investment_intent payload
    const investmentIntent: InvestmentIntent | null = investment.isSeekingInvestment
      ? {
          isSeekingInvestment: true,
          visibility: investment.visibility,
          sharedWithESG: investment.sharedWithESG,
          investmentDetails: {
            amountRaising: investment.amountRaising ? parseFloat(investment.amountRaising) : null,
            currency: investment.currency || null,
            fundingStage: (investment.fundingStage as FundingStage) || null,
            useOfFunds: investment.useOfFunds.trim() || null,
            currentTraction: investment.currentTraction.trim() || null,
            expectedCloseDate: investment.expectedCloseDate || null,
            pitchDeckUrl: investment.pitchDeckUrl.trim() || null,
            existingInvestors: investment.existingInvestors.trim() || null,
          },
        }
      : null

    // Use the PATCH API route — this verifies authorisation server-side
    // and uses the admin client to bypass RLS, so both org creators AND
    // platform admins can save changes without RLS blocking the write.
    const res = await fetch(`/api/organisations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
        investment_intent: investmentIntent,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Could not save. Please try again.')
      return
    }
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
          <p style={{ color: muted, marginBottom: '1.5rem' }}>Only the organisation creator, admin or platform administrator can edit this.</p>
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
              <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. London, UK" maxLength={100} />
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

        {/* ── Seeking Investment ── */}
        <section style={{ background: card, border: `1px solid ${investment.isSeekingInvestment ? 'rgba(52,211,153,0.3)' : border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: investment.isSeekingInvestment ? '1.25rem' : 0 }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: investment.isSeekingInvestment ? '#34d399' : text }}>
              💰 Seeking Investment
            </h3>
            {/* Toggle button */}
            <button
              type="button"
              onClick={() => setInv('isSeekingInvestment', !investment.isSeekingInvestment)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: investment.isSeekingInvestment ? 'rgba(52,211,153,0.15)' : '#1f2937',
                border: `1px solid ${investment.isSeekingInvestment ? 'rgba(52,211,153,0.3)' : border}`,
                borderRadius: 10, padding: '0.45rem 0.9rem',
                fontSize: '0.8rem', fontWeight: 700,
                color: investment.isSeekingInvestment ? '#34d399' : muted,
                cursor: 'pointer',
              }}
            >
              {/* Pill toggle track */}
              <span style={{
                width: 28, height: 16, borderRadius: 20,
                background: investment.isSeekingInvestment ? '#34d399' : '#374151',
                display: 'inline-block', position: 'relative', transition: 'background 0.2s',
                flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 2,
                  left: investment.isSeekingInvestment ? 14 : 2,
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </span>
              {investment.isSeekingInvestment ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {investment.isSeekingInvestment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Amount + Currency */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Amount raising</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    value={investment.amountRaising}
                    onChange={e => setInv('amountRaising', e.target.value)}
                    placeholder="e.g. 500000"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={investment.currency}
                    onChange={e => setInv('currency', e.target.value)}
                  >
                    <option value="€">€ EUR</option>
                    <option value="$">$ USD</option>
                    <option value="£">£ GBP</option>
                  </select>
                </div>
              </div>

              {/* Funding Stage */}
              <div>
                <label style={labelStyle}>Funding stage</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={investment.fundingStage}
                  onChange={e => setInv('fundingStage', e.target.value as InvestmentForm['fundingStage'])}
                >
                  <option value="">Select stage…</option>
                  {(['Pre-Seed', 'Seed', 'Series A', 'Growth', 'Other'] as FundingStage[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Use of Funds */}
              <div>
                <label style={labelStyle}>Use of funds</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  value={investment.useOfFunds}
                  onChange={e => setInv('useOfFunds', e.target.value)}
                  placeholder="How will the investment be used?"
                  maxLength={500}
                />
              </div>

              {/* Current Traction */}
              <div>
                <label style={labelStyle}>
                  Current traction{' '}
                  <span style={{ fontWeight: 400, color: muted }}>(key metrics or milestones)</span>
                </label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  value={investment.currentTraction}
                  onChange={e => setInv('currentTraction', e.target.value)}
                  placeholder="e.g. 50 paying clients, €20k MRR, 3 partnerships signed…"
                  maxLength={500}
                />
              </div>

              {/* Expected Close Date */}
              <div>
                <label style={labelStyle}>
                  Expected close date{' '}
                  <span style={{ fontWeight: 400, color: muted }}>(optional)</span>
                </label>
                <input
                  style={inputStyle}
                  type="date"
                  value={investment.expectedCloseDate}
                  onChange={e => setInv('expectedCloseDate', e.target.value)}
                />
              </div>

              {/* Pitch Deck URL */}
              <div>
                <label style={labelStyle}>
                  Pitch deck URL{' '}
                  <span style={{ fontWeight: 400, color: muted }}>(optional — Google Drive, Docsend, etc.)</span>
                </label>
                <input
                  style={inputStyle}
                  value={investment.pitchDeckUrl}
                  onChange={e => setInv('pitchDeckUrl', e.target.value)}
                  placeholder="https://…"
                  maxLength={500}
                />
              </div>

              {/* Existing Investors */}
              <div>
                <label style={labelStyle}>
                  Existing investors{' '}
                  <span style={{ fontWeight: 400, color: muted }}>(optional)</span>
                </label>
                <input
                  style={inputStyle}
                  value={investment.existingInvestors}
                  onChange={e => setInv('existingInvestors', e.target.value)}
                  placeholder="e.g. Enterprise Ireland, angel investors…"
                  maxLength={300}
                />
              </div>

              {/* Visibility toggle */}
              <div>
                <label style={labelStyle}>Visibility</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {(['private', 'public'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setInv('visibility', v)}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 10,
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${investment.visibility === v ? accent : border}`,
                        background: investment.visibility === v ? 'rgba(139,92,246,0.12)' : '#1f2937',
                        color: investment.visibility === v ? accent : muted,
                      }}
                    >
                      {v === 'private' ? '🔒 Private' : '🌐 Public'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: muted, marginTop: 6, lineHeight: 1.5 }}>
                  {investment.visibility === 'private'
                    ? 'Investment details are only visible to you and org admins.'
                    : 'Investment details are visible on your public profile to all visitors.'}
                </div>
              </div>

              {/* ESG Network checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '0.75rem',
                  background: investment.sharedWithESG ? 'rgba(16,185,129,0.06)' : '#1f2937',
                  border: `1px solid ${investment.sharedWithESG ? 'rgba(16,185,129,0.25)' : border}`,
                  borderRadius: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={investment.sharedWithESG}
                  onChange={e => setInv('sharedWithESG', e.target.checked)}
                  style={{ width: 16, height: 16, marginTop: 2, accentColor: '#34d399', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: investment.sharedWithESG ? '#34d399' : text }}>
                    🌿 Share with ESG investor network
                  </div>
                  <div style={{ fontSize: '0.75rem', color: muted, marginTop: 3, lineHeight: 1.5 }}>
                    Your investment summary may be included in curated deal drops and investor communications. This does not automatically make your profile public.
                  </div>
                </div>
              </label>

            </div>
          )}
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
