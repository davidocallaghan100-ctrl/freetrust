'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

const BUSINESS_TYPES = [
  'Sole Trader', 'Limited Company', 'Partnership',
  'Charity', 'Social Enterprise', 'Community Group',
  'Non Profit', 'Cooperative',
]
const INDUSTRIES = [
  'Technology & Software', 'Design & Creative', 'Marketing & Advertising',
  'Finance & Accounting', 'Legal & Compliance', 'Healthcare & Wellness',
  'Education & Training', 'Retail & E-commerce', 'Food & Hospitality',
  'Construction & Trades', 'Logistics & Transport', 'Arts & Entertainment',
  'Social Impact & Charity', 'Consulting & Advisory', 'Media & Publishing',
  'Agriculture & Environment', 'Manufacturing', 'Other',
]
const SOCIAL_PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook', 'youtube', 'tiktok']

interface FormData {
  name: string
  business_type: string
  industry: string
  description: string
  mission: string
  website: string
  location: string
  service_area: string
  contact_email: string
  contact_phone: string
  vat_number: string
  registration_number: string
  founded_date: string
  social_links: Record<string, string>
}

export default function CreateBusinessPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormData>({
    name: '', business_type: '', industry: '',
    description: '', mission: '', website: '',
    location: '', service_area: '', contact_email: '',
    contact_phone: '', vat_number: '', registration_number: '',
    founded_date: '', social_links: {},
  })

  const set = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }))
  const setSocial = (platform: string, val: string) =>
    setForm(f => ({ ...f, social_links: { ...f.social_links, [platform]: val } }))

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create business')
      router.push(`/business/${json.business.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#f1f5f9',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.78rem', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    display: 'block', marginBottom: '0.35rem',
  }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem' }

  return (
    <div style={{ minHeight: 'calc(100vh - 104px)', background: '#0f172a', paddingTop: 104, fontFamily: 'system-ui', color: '#f1f5f9' }}>
      <style>{`
        .cb-type-btn { padding: 0.7rem 1rem; border-radius: 10px; border: 1px solid rgba(148,163,184,0.2); background: transparent; cursor: pointer; font-size: 0.85rem; color: #94a3b8; transition: all 0.12s; text-align: left; }
        .cb-type-btn.active { border-color: #38bdf8; background: rgba(56,189,248,0.1); color: #38bdf8; font-weight: 600; }
        .cb-type-btn:hover { border-color: rgba(56,189,248,0.3); color: #f1f5f9; }
        .cb-step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.3rem' }}>Create Business Profile</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Set up your business presence on FreeTrust</p>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {['Basic Info', 'Details', 'Contact & Links', 'Preview'].map((label, i) => {
            const s = i + 1
            const done = step > s
            const active = step === s
            return (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div className="cb-step-dot" style={{
                    background: done ? '#38bdf8' : active ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.1)',
                    color: done ? '#0f172a' : active ? '#38bdf8' : '#64748b',
                    border: active ? '2px solid #38bdf8' : done ? 'none' : '2px solid rgba(148,163,184,0.2)',
                  }}>
                    {done ? '✓' : s}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: active ? '#f1f5f9' : '#64748b', fontWeight: active ? 600 : 400 }}>{label}</span>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.1)', minWidth: 16 }} />}
              </React.Fragment>
            )
          })}
        </div>

        {/* Card */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: '2rem' }}>

          {/* STEP 1 — Basic Info */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Basic Information</h2>

              <div style={fieldStyle}>
                <label style={labelStyle}>Business Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Acme Design Studio" />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Business Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                  {BUSINESS_TYPES.map(t => (
                    <button key={t} className={`cb-type-btn${form.business_type === t ? ' active' : ''}`} onClick={() => set('business_type', t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Industry / Category *</label>
                <select style={{ ...inputStyle, background: '#0f172a' }} value={form.industry} onChange={e => set('industry', e.target.value)}>
                  <option value="">Select an industry…</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Founded Date</label>
                <input style={inputStyle} type="date" value={form.founded_date} onChange={e => set('founded_date', e.target.value)} />
              </div>
            </div>
          )}

          {/* STEP 2 — Details */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>About Your Business</h2>

              <div style={fieldStyle}>
                <label style={labelStyle}>Business Description *</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what your business does…" rows={4} maxLength={1000} />
                <div style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'right' }}>{form.description.length}/1000</div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Mission Statement</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} value={form.mission} onChange={e => set('mission', e.target.value)} placeholder="What is the purpose or mission of your business?" rows={3} maxLength={500} />
                <div style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'right' }}>{form.mission.length}/500</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Location</label>
                  <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="City, Country" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Service Area</label>
                  <input style={inputStyle} value={form.service_area} onChange={e => set('service_area', e.target.value)} placeholder="e.g. UK-wide, Global" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Contact & Links */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Contact & Links</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Contact Email</label>
                  <input style={inputStyle} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="hello@business.com" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Contact Phone</label>
                  <input style={inputStyle} type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+44 7700 000000" />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Website URL</label>
                <input style={inputStyle} type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://yourbusiness.com" />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Social Media Links</label>
                {SOCIAL_PLATFORMS.map(platform => (
                  <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 90, fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize' }}>{platform}</span>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={form.social_links[platform] ?? ''}
                      onChange={e => setSocial(platform, e.target.value)}
                      placeholder={`${platform}.com/yourprofile`}
                    />
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid rgba(56,189,248,0.08)', paddingTop: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', margin: '0 0 1rem' }}>Registration (Optional)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>VAT Number</label>
                    <input style={inputStyle} value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="GB123456789" />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Company Reg. Number</label>
                    <input style={inputStyle} value={form.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="12345678" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Preview */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>Review & Create</h2>

              {[
                { label: 'Business Name', value: form.name },
                { label: 'Type', value: form.business_type },
                { label: 'Industry', value: form.industry },
                { label: 'Location', value: form.location || '—' },
                { label: 'Website', value: form.website || '—' },
                { label: 'Contact', value: form.contact_email || '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(56,189,248,0.06)', fontSize: '0.88rem' }}>
                  <span style={{ color: '#64748b' }}>{row.label}</span>
                  <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}

              {form.description && (
                <div style={{ marginTop: '1rem', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>DESCRIPTION</div>
                  <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>{form.description}</p>
                </div>
              )}

              {error && (
                <div style={{ marginTop: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#fca5a5' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', gap: '0.75rem' }}>
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, padding: '0.75rem 1.5rem', fontSize: '0.88rem', color: '#64748b', cursor: 'pointer' }}>
                ← Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={(step === 1 && (!form.name || !form.business_type || !form.industry))}
                style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 10, padding: '0.75rem 2rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', opacity: (step === 1 && (!form.name || !form.business_type || !form.industry)) ? 0.5 : 1 }}
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={saving}
                style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 10, padding: '0.75rem 2rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Creating…' : '🚀 Create Business Profile'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
