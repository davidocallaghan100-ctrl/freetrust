'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
]
const LOCATION_TYPES = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on_site', label: 'On-Site' },
]
const CATEGORIES = ['Tech', 'Design', 'Marketing', 'Sales', 'Finance', 'Operations', 'Trades', 'Other']
const COMPANY_SIZES = ['1–10', '11–50', '51–200', '200–500', '500+']

const TYPE_COLORS: Record<string, string> = {
  full_time: '#38bdf8', part_time: '#a78bfa', contract: '#fbbf24', freelance: '#34d399',
}
const LOC_COLORS: Record<string, string> = { remote: '#34d399', hybrid: '#38bdf8', on_site: '#fb923c' }

export default function PostJobPage() {
  const router = useRouter()
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    // Company details
    company_name: '',
    company_logo_url: '',
    company_website: '',
    company_size: '',
    company_description: '',
    // Job details
    title: '',
    description: '',
    requirements: '',
    job_type: 'full_time',
    location_type: 'remote',
    location: '',
    category: 'Tech',
    tags: [] as string[],
    salary_min: '',
    salary_max: '',
    salary_currency: 'EUR',
    application_deadline: '',
  })

  // Safety net: if still "submitting" after 20 seconds, auto-reset
  useEffect(() => {
    if (submitting) {
      submitTimeoutRef.current = setTimeout(() => {
        setSubmitting(false)
        setError('The request is taking too long. Please try again.')
      }, 20000)
    } else {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current)
    }
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current)
    }
  }, [submitting])

  const set = (k: string, v: string | string[]) => setForm(f => ({ ...f, [k]: v }))

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && !form.tags.includes(t) && form.tags.length < 10) {
      set('tags', [...form.tags, t])
      setTagInput('')
    }
  }

  const removeTag = (t: string) => set('tags', form.tags.filter(x => x !== t))

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB.')
      return
    }
    setLogoUploading(true)
    setError('')
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(path, file, { upsert: true })
      if (uploadError) {
        setError(`Logo upload failed: ${uploadError.message}`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('company-logos').getPublicUrl(path)
      setForm(f => ({ ...f, company_logo_url: publicUrl }))
    } catch (err) {
      setError('Logo upload failed. Please try again.')
      console.error('[logo upload]', err)
    } finally {
      setLogoUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.job_type) {
      setError('Please fill in title, description and job type.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setSubmitting(false)
        router.push('/login?redirect=/jobs/new')
        return
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          salary_min: form.salary_min ? parseInt(form.salary_min) : null,
          salary_max: form.salary_max ? parseInt(form.salary_max) : null,
          application_deadline: form.application_deadline || null,
          company_name: form.company_name || null,
          company_logo_url: form.company_logo_url || null,
          company_website: form.company_website || null,
          company_size: form.company_size || null,
          company_description: form.company_description || null,
        }),
      })

      let json: { job?: { id?: string }; error?: string } = {}
      try {
        json = await res.json()
      } catch {
        throw new Error('Server returned an unexpected response. Please try again.')
      }

      if (!res.ok) throw new Error(json.error || `Failed to post job (${res.status})`)

      const jobId = json.job?.id
      if (!jobId) throw new Error('Job was created but no ID was returned.')

      // Reset submitting before navigating so the spinner clears immediately
      setSubmitting(false)
      router.push(`/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: 8, padding: '0.65rem 1rem', color: '#f1f5f9', fontSize: '0.9rem',
    outline: 'none', fontFamily: 'system-ui', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem', display: 'block',
  }
  const sectionStyle: React.CSSProperties = { marginBottom: '1.5rem' }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  const sectionDivider = (icon: string, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(56,189,248,0.1)' }} />
    </div>
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .new-job-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
        .new-job-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
        @media (max-width: 768px) {
          .new-job-grid { grid-template-columns: 1fr; }
          .new-job-grid-3 { grid-template-columns: 1fr; }
          .new-job-inner { padding: 1rem !important; }
        }
        input[type="file"]::file-selector-button {
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 6px;
          color: #38bdf8;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.35rem 0.75rem;
          margin-right: 0.75rem;
        }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2rem 1.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.4rem' }}>Post a Job</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Reach thousands of trusted professionals in the FreeTrust network</p>
          <div style={{ marginTop: '0.75rem', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.82rem', color: '#38bdf8' }}>
            ⭐ Your FreeTrust score is shown to applicants — verified employers (score &gt; 200) get priority listing
          </div>
        </div>
      </div>

      <div className="new-job-inner" style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Preview toggle */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <button onClick={() => setPreview(false)} style={{ padding: '0.45rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: !preview ? '#38bdf8' : 'transparent', color: !preview ? '#0f172a' : '#94a3b8', border: !preview ? 'none' : '1px solid rgba(148,163,184,0.2)' }}>
            ✏️ Edit
          </button>
          <button onClick={() => setPreview(true)} style={{ padding: '0.45rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: preview ? '#38bdf8' : 'transparent', color: preview ? '#0f172a' : '#94a3b8', border: preview ? 'none' : '1px solid rgba(148,163,184,0.2)' }}>
            👁 Preview Card
          </button>
        </div>

        {preview ? (
          /* Preview Card */
          <div style={{ background: '#1e293b', border: '2px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.5rem', maxWidth: 480 }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 600 }}>PREVIEW — how your job will appear</div>

            {/* Company row in preview */}
            {form.company_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                {form.company_logo_url ? (
                  <img src={form.company_logo_url} alt={form.company_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(56,189,248,0.2)', background: '#0f172a' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🏢</div>
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>{form.company_name}</div>
                  {form.company_size && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{form.company_size} employees</div>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {form.job_type && <span style={{ background: `${TYPE_COLORS[form.job_type]}18`, color: TYPE_COLORS[form.job_type], border: `1px solid ${TYPE_COLORS[form.job_type]}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
                {JOB_TYPES.find(t => t.value === form.job_type)?.label}
              </span>}
              {form.location_type && <span style={{ background: `${LOC_COLORS[form.location_type]}18`, color: LOC_COLORS[form.location_type], border: `1px solid ${LOC_COLORS[form.location_type]}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
                {LOCATION_TYPES.find(l => l.value === form.location_type)?.label}
              </span>}
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{form.title || 'Job Title'}</h3>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              {form.location_type !== 'remote' && form.location ? `📍 ${form.location}  ` : ''}
              {form.salary_min || form.salary_max ? `💰 ${form.salary_currency === 'EUR' ? '€' : form.salary_currency === 'USD' ? '$' : '£'}${form.salary_min || '?'}k – ${form.salary_currency === 'EUR' ? '€' : form.salary_currency === 'USD' ? '$' : '£'}${form.salary_max || '?'}k` : '💰 Competitive'}
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {form.tags.map(t => <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.12rem 0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>)}
              </div>
            )}
            <button style={{ width: '100%', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 7, padding: '0.5rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem' }}>Apply Now →</button>
          </div>
        ) : (
          /* Edit Form */
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '2rem' }}>

            {/* ── COMPANY DETAILS ── */}
            {sectionDivider('🏢', 'Company Details')}

            <div style={sectionStyle}>
              <label style={labelStyle}>Company Name</label>
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. Acme Technologies" style={inputStyle} />
            </div>

            {/* Logo upload */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Company Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {form.company_logo_url ? (
                  <img
                    src={form.company_logo_url}
                    alt="Company logo"
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(56,189,248,0.3)', background: '#0f172a', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(56,189,248,0.06)', border: '1px dashed rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>
                    🏢
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={logoUploading}
                    style={{ ...inputStyle, padding: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: '#94a3b8' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.3rem' }}>
                    {logoUploading ? '⏳ Uploading...' : 'PNG, JPG, WebP or SVG · Max 2MB'}
                  </div>
                  {form.company_logo_url && (
                    <button
                      onClick={() => set('company_logo_url', '')}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', padding: 0, marginTop: '0.2rem' }}
                    >
                      ✕ Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="new-job-grid" style={sectionStyle}>
              <div>
                <label style={labelStyle}>Company Website</label>
                <input value={form.company_website} onChange={e => set('company_website', e.target.value)} placeholder="https://yourcompany.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Company Size</label>
                <select value={form.company_size} onChange={e => set('company_size', e.target.value)} style={selectStyle}>
                  <option value="">Select size...</option>
                  {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                </select>
              </div>
            </div>

            <div style={sectionStyle}>
              <label style={labelStyle}>About the Company</label>
              <textarea
                value={form.company_description}
                onChange={e => set('company_description', e.target.value)}
                placeholder="Brief description of your company, culture, and what makes it a great place to work..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* ── JOB DETAILS ── */}
            {sectionDivider('📋', 'Job Details')}

            <div style={sectionStyle}>
              <label style={labelStyle}>Job Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Senior Full-Stack Engineer" style={inputStyle} />
            </div>

            <div style={sectionStyle}>
              <label style={labelStyle}>Description *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the role, responsibilities, and what you're looking for..." rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            </div>

            <div style={sectionStyle}>
              <label style={labelStyle}>Requirements</label>
              <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)} placeholder="List skills, qualifications, and experience required..." rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            </div>

            <div className="new-job-grid" style={sectionStyle}>
              <div>
                <label style={labelStyle}>Job Type *</label>
                <select value={form.job_type} onChange={e => set('job_type', e.target.value)} style={selectStyle}>
                  {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Location Type *</label>
                <select value={form.location_type} onChange={e => set('location_type', e.target.value)} style={selectStyle}>
                  {LOCATION_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {(form.location_type === 'hybrid' || form.location_type === 'on_site') && (
              <div style={sectionStyle}>
                <label style={labelStyle}>Location (City / Country)</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. London, UK" style={inputStyle} />
              </div>
            )}

            <div className="new-job-grid" style={sectionStyle}>
              <div>
                <label style={labelStyle}>Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} style={selectStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Application Deadline</label>
                <input type="date" value={form.application_deadline} onChange={e => set('application_deadline', e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={sectionStyle}>
              <label style={labelStyle}>Salary Range (annual, or daily rate for freelance)</label>
              <div className="new-job-grid-3">
                <div>
                  <input value={form.salary_min} onChange={e => set('salary_min', e.target.value)} placeholder="Min (e.g. 50000)" type="number" style={inputStyle} />
                </div>
                <div>
                  <input value={form.salary_max} onChange={e => set('salary_max', e.target.value)} placeholder="Max (e.g. 70000)" type="number" style={inputStyle} />
                </div>
                <div>
                  <select value={form.salary_currency} onChange={e => set('salary_currency', e.target.value)} style={selectStyle}>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <label style={labelStyle}>Skills & Tags (max 10)</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Type a skill and press Enter..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={addTag} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0 1rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
              {form.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {form.tags.map(t => (
                    <span key={t} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {t}
                      <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || logoUploading}
              style={{
                width: '100%',
                background: submitting ? 'rgba(56,189,248,0.5)' : '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 10,
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: (submitting || logoUploading) ? 'not-allowed' : 'pointer',
                opacity: (submitting || logoUploading) ? 0.7 : 1,
                transition: 'background 0.2s',
              }}
            >
              {submitting ? '⏳ Posting...' : logoUploading ? '⏳ Uploading logo...' : '🚀 Post Job'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
