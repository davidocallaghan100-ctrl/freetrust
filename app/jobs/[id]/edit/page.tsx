'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface JobData {
  id: string
  title: string
  description: string
  requirements: string | null
  job_type: string
  location_type: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  category: string
  tags: string[]
  status: string
  poster_id?: string
  poster?: { id: string }
  company_logo_url?: string | null
  company_name?: string | null
  company_website?: string | null
}

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'internship', label: 'Internship' },
]

const LOC_TYPES = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on_site', label: 'On-Site' },
]

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'filled', label: 'Filled' },
  { value: 'draft', label: 'Draft' },
]

const s = {
  card: { background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '1.5rem' } as React.CSSProperties,
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 } as React.CSSProperties,
  input: { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, padding: '0.65rem 0.85rem', color: '#f1f5f9', fontSize: '16px', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  textarea: { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, padding: '0.65rem 0.85rem', color: '#f1f5f9', fontSize: '16px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const, minHeight: 100 } as React.CSSProperties,
  select: { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, padding: '0.65rem 0.85rem', color: '#f1f5f9', fontSize: '16px', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  btn: { padding: '0.75rem 1.5rem', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
}

export default function EditJobPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '', description: '', requirements: '', job_type: 'full_time',
    location_type: 'remote', location: '', salary_min: '', salary_max: '',
    salary_currency: 'EUR', category: '', tags: '' as string, status: 'active',
    company_logo_url: '', company_name: '', company_website: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/login?redirect=/jobs/${jobId}/edit`); return }

      const res = await fetch(`/api/jobs/${jobId}/apply`, { cache: 'no-store' })
      if (!res.ok) { setError('Job not found'); setLoading(false); return }
      const data = await res.json() as { job: JobData }
      const job = data.job

      const posterId = job.poster_id ?? job.poster?.id
      if (posterId !== user.id) { setForbidden(true); setLoading(false); return }

      setForm({
        title: job.title ?? '',
        description: job.description ?? '',
        requirements: job.requirements ?? '',
        job_type: job.job_type ?? 'full_time',
        location_type: job.location_type ?? 'remote',
        location: job.location ?? '',
        salary_min: job.salary_min != null ? String(job.salary_min) : '',
        salary_max: job.salary_max != null ? String(job.salary_max) : '',
        salary_currency: job.salary_currency ?? 'EUR',
        category: job.category ?? '',
        tags: (job.tags ?? []).join(', '),
        status: job.status ?? 'active',
        company_logo_url: job.company_logo_url ?? '',
        company_name: job.company_name ?? '',
        company_website: job.company_website ?? '',
      })
      setLoading(false)
    }
    load()
  }, [jobId, router])

  // ── Logo upload (same pattern as /jobs/new) ──────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB.')
      return
    }
    setLogoUploading(true)
    setError(null)
    const safetyTimer = setTimeout(() => {
      setLogoUploading(false)
      setError('Logo upload timed out. You can save without changing the logo.')
    }, 15000)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(path, file, { upsert: true })
      if (uploadError) {
        setError(`Logo upload failed: ${uploadError.message}.`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('company-logos').getPublicUrl(path)
      setForm(f => ({ ...f, company_logo_url: publicUrl }))
    } catch (err) {
      setError('Logo upload failed. You can save without a logo.')
      console.error('[logo upload]', err)
    } finally {
      clearTimeout(safetyTimer)
      setLogoUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) { setError('Title and description are required'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          requirements: form.requirements.trim() || null,
          job_type: form.job_type,
          location_type: form.location_type,
          location: form.location.trim() || null,
          salary_min: form.salary_min ? parseInt(form.salary_min, 10) : null,
          salary_max: form.salary_max ? parseInt(form.salary_max, 10) : null,
          salary_currency: form.salary_currency,
          category: form.category.trim(),
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          status: form.status,
          company_logo_url: form.company_logo_url || null,
          company_name: form.company_name.trim() || null,
          company_website: form.company_website.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Save failed')
      }
      router.push(`/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return <div style={{ minHeight: '100vh', paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading job...</div>
  if (forbidden) return (
    <div style={{ minHeight: '100vh', paddingTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f87171', gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>You don&apos;t have permission to edit this job</div>
      <Link href={`/jobs/${jobId}`} style={{ color: '#38bdf8', textDecoration: 'none', fontSize: 14 }}>← Back to job</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ padding: '1.5rem 0 1rem' }}>
          <Link href={`/jobs/${jobId}`} style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>← Back to job</Link>
          <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.7rem)', fontWeight: 800, margin: '0.75rem 0 0.25rem' }}>Edit Job</h1>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 16, fontSize: 13, color: '#f87171' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Logo / Company section ── */}
          <div style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Company / Organisation</div>

            {/* Logo preview + upload */}
            <div>
              <label style={s.label}>Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Preview */}
                <div style={{
                  width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {form.company_logo_url ? (
                    <img src={form.company_logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 28, opacity: 0.4 }}>🏢</span>
                  )}
                </div>

                {/* Upload controls */}
                <div style={{ flex: 1 }}>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    style={{
                      padding: '0.55rem 1rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                      background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                      color: '#38bdf8', cursor: logoUploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {logoUploading ? 'Uploading…' : form.company_logo_url ? '🔄 Change Logo' : '📷 Upload Logo'}
                  </button>
                  {form.company_logo_url && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, company_logo_url: '' }))}
                      style={{ marginLeft: 8, padding: '0.55rem 0.75rem', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Remove
                    </button>
                  )}
                  <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>Max 2MB · JPG, PNG, WebP</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={s.label}>Company name</label><input style={s.input} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. FreeTrust" /></div>
              <div><label style={s.label}>Company website</label><input style={s.input} value={form.company_website} onChange={e => set('company_website', e.target.value)} placeholder="https://..." /></div>
            </div>
          </div>

          {/* ── Job details section ── */}
          <div style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Job Details</div>

            <div><label style={s.label}>Title *</label><input style={s.input} value={form.title} onChange={e => set('title', e.target.value)} required /></div>
            <div><label style={s.label}>Description *</label><textarea style={s.textarea} value={form.description} onChange={e => set('description', e.target.value)} required rows={5} /></div>
            <div><label style={s.label}>Requirements</label><textarea style={s.textarea} value={form.requirements} onChange={e => set('requirements', e.target.value)} rows={3} /></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={s.label}>Job type</label><select style={s.select} value={form.job_type} onChange={e => set('job_type', e.target.value)}>{JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label style={s.label}>Location type</label><select style={s.select} value={form.location_type} onChange={e => set('location_type', e.target.value)}>{LOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            </div>

            <div><label style={s.label}>Location</label><input style={s.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. London, UK" /></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label style={s.label}>Min salary</label><input style={s.input} type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} /></div>
              <div><label style={s.label}>Max salary</label><input style={s.input} type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} /></div>
              <div><label style={s.label}>Currency</label><select style={s.select} value={form.salary_currency} onChange={e => set('salary_currency', e.target.value)}><option>EUR</option><option>USD</option><option>GBP</option></select></div>
            </div>

            <div><label style={s.label}>Category</label><input style={s.input} value={form.category} onChange={e => set('category', e.target.value)} /></div>
            <div><label style={s.label}>Tags (comma-separated)</label><input style={s.input} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. react, nextjs, remote" /></div>

            <div><label style={s.label}>Status</label><select style={s.select} value={form.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}</select></div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Link href={`/jobs/${jobId}`} style={{ ...s.btn, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Cancel</Link>
            <button type="submit" disabled={saving || logoUploading} style={{ ...s.btn, background: '#38bdf8', color: '#0f172a', opacity: (saving || logoUploading) ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
