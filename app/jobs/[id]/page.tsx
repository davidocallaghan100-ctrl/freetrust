'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Job {
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
  created_at: string
  updated_at: string
  applicant_count: number
  application_deadline: string | null
  poster?: { id: string; full_name: string | null; bio: string | null; created_at: string; trust_balance?: number }
}

interface SimilarJob {
  id: string; title: string; job_type: string; location_type: string
  salary_min: number | null; salary_max: number | null; salary_currency: string
  poster_name: string
}

const TYPE_LABELS: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', freelance: 'Freelance' }
const TYPE_COLORS: Record<string, string> = { full_time: '#38bdf8', part_time: '#a78bfa', contract: '#fbbf24', freelance: '#34d399' }
const LOC_COLORS: Record<string, string> = { remote: '#34d399', hybrid: '#38bdf8', on_site: '#fb923c' }
const LOC_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', on_site: 'On-Site' }

const MOCK_JOB: Job = {
  id: '1', title: 'Senior Full-Stack Engineer', description: `We are looking for an experienced Full-Stack Engineer to join our growing product team. You will work closely with design, product, and backend engineers to build features that serve thousands of users across the FreeTrust platform.\n\nYou will own complete feature development from API design through to frontend implementation, and be expected to contribute to architecture decisions, code reviews, and engineering culture.\n\nThis is a remote-first role with flexible hours. We care about outcomes, not hours.`,
  requirements: `• 4+ years of professional software engineering experience\n• Strong TypeScript and React skills\n• Experience with Next.js (app router preferred)\n• Comfortable with SQL and Supabase or similar BaaS\n• Git-based workflow, code review experience\n• Bonus: experience with real-time features, WebSockets or Supabase Realtime\n• Bonus: experience at a startup or scale-up`,
  job_type: 'full_time', location_type: 'remote', location: null, salary_min: 70000, salary_max: 95000, salary_currency: 'EUR',
  category: 'Tech', tags: ['React', 'Node.js', 'TypeScript', 'Next.js', 'Supabase'],
  created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString(),
  applicant_count: 24, application_deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
  poster: { id: 'poster-1', full_name: 'SaaS Builders Co', bio: 'We build B2B SaaS tools for modern teams. 45 people, Series A, fully remote.', created_at: '2023-06-01T00:00:00Z', trust_balance: 312 },
}

const SIMILAR_JOBS_FALLBACK: SimilarJob[] = []

function formatSalary(min: number | null, max: number | null, currency: string, type: string) {
  if (!min && !max) return 'Competitive'
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
  const isDaily = type === 'freelance' && (min ?? 0) < 2000
  const fmt = (n: number) => isDaily ? `${sym}${n}/day` : n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  return min ? `From ${fmt(min)}` : `Up to ${fmt(max!)}`
}

function daysUntil(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (diff < 0) return 'Closed'
  if (diff === 0) return 'Closes today'
  return `${diff} day${diff !== 1 ? 's' : ''} left`
}

export default function JobDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [job, setJob] = useState<Job | null>(null)
  const [jobLoading, setJobLoading] = useState(true)
  const [similarJobs, setSimilarJobs] = useState<SimilarJob[]>(SIMILAR_JOBS_FALLBACK)
  const [showModal, setShowModal] = useState(false)
  const [applied, setApplied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [appError, setAppError] = useState('')
  const [form, setForm] = useState({ cover_letter: '', cv_url: '', portfolio_url: '' })
  const [cvMode, setCvMode] = useState<'upload' | 'link'>('upload')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvUploading, setCvUploading] = useState(false)
  const [cvFileName, setCvFileName] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('jobs')
          .select('*, poster:profiles!poster_id(id, full_name, bio, created_at, trust_balance)')
          .eq('id', id)
          .single()
        if (data) {
          setJob(data as Job)
          // Load similar jobs from same category, excluding current
          const { data: similar } = await supabase
            .from('jobs')
            .select('id, title, job_type, location_type, salary_min, salary_max, salary_currency, poster:profiles!poster_id(full_name)')
            .eq('status', 'active')
            .eq('category', (data as Job).category)
            .neq('id', id)
            .limit(3)
          if (similar && similar.length > 0) {
            setSimilarJobs(similar.map((j: Record<string, unknown>) => ({
              id: j.id as string,
              title: j.title as string,
              job_type: j.job_type as string,
              location_type: j.location_type as string,
              salary_min: j.salary_min as number | null,
              salary_max: j.salary_max as number | null,
              salary_currency: j.salary_currency as string,
              poster_name: (j.poster as { full_name: string | null } | null)?.full_name ?? 'FreeTrust Member',
            })))
          }
        } else {
          setJob(MOCK_JOB)
        }
      } catch {
        setJob(MOCK_JOB)
      } finally {
        setJobLoading(false)
      }
    }
    if (id) load()
  }, [id])

  const handleCvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowed.includes(file.type)) { setAppError('Please upload a PDF or Word document.'); return }
    if (file.size > 5 * 1024 * 1024) { setAppError('File must be under 5MB.'); return }
    setAppError('')
    setCvFile(file)
    setCvFileName(file.name)
    // Upload immediately so we have the URL ready
    setCvUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `resumes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('uploads').upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      setForm(f => ({ ...f, cv_url: publicUrl }))
    } catch {
      // If upload bucket doesn't exist yet, we'll submit without it and note it
      setAppError('Resume upload failed — you can paste a link instead, or submit without one.')
      setCvFile(null)
      setCvFileName('')
    } finally {
      setCvUploading(false)
    }
  }

  const handleApply = async () => {
    if (!form.cover_letter.trim()) { setAppError('Cover letter is required.'); return }
    if (cvUploading) { setAppError('Please wait for your resume to finish uploading.'); return }
    setSubmitting(true); setAppError('')
    try {
      const res = await fetch(`/api/jobs/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to apply')
      setApplied(true)
    } catch (err) {
      setAppError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: 8, padding: '0.65rem 1rem', color: '#f1f5f9', fontSize: '0.9rem',
    outline: 'none', fontFamily: 'system-ui', boxSizing: 'border-box',
  }

  if (jobLoading) return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 104 }}>
      <div style={{ color: '#38bdf8', fontSize: '1rem' }}>Loading job…</div>
    </div>
  )

  if (!job) return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', paddingTop: 104 }}>
      <div style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Job not found</div>
      <Link href="/jobs" style={{ color: '#38bdf8', textDecoration: 'none' }}>← Back to Jobs</Link>
    </div>
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 104 }}>
      <style>{`
        .job-detail-layout { display: grid; grid-template-columns: 1fr 320px; gap: 2rem; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; align-items: start; }
        .job-apply-sticky { position: sticky; top: 78px; }
        .job-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .job-modal { background: #1e293b; border: 1px solid rgba(56,189,248,0.2); border-radius: 16px; padding: 2rem; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        @media (max-width: 768px) {
          .job-detail-layout { grid-template-columns: 1fr; padding: 1rem 1rem 6rem; gap: 1.5rem; }
          .job-apply-sticky { position: static; }
          .job-apply-mobile-cta { display: block !important; }
          .job-modal { max-width: 100%; border-radius: 16px 16px 0 0; position: fixed; bottom: 0; left: 0; right: 0; max-height: 85vh; }
          .job-modal-overlay { align-items: flex-end; padding: 0; }
        }
      `}</style>

      {/* Sticky mobile CTA */}
      <div className="job-apply-mobile-cta" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem', background: '#0f172a', borderTop: '1px solid rgba(56,189,248,0.1)', zIndex: 100 }}>
        <button onClick={() => setShowModal(true)} style={{ width: '100%', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, cursor: 'pointer' }}>
          Apply Now →
        </button>
      </div>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem 1.5rem 0' }}>
        <Link href="/jobs" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          ← Back to Jobs
        </Link>
      </div>

      <div className="job-detail-layout">
        {/* Main content */}
        <div>
          {/* Job header */}
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span style={{ background: `${TYPE_COLORS[job.job_type]}18`, color: TYPE_COLORS[job.job_type], border: `1px solid ${TYPE_COLORS[job.job_type]}30`, borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 600 }}>
                {TYPE_LABELS[job.job_type]}
              </span>
              <span style={{ background: `${LOC_COLORS[job.location_type]}18`, color: LOC_COLORS[job.location_type], border: `1px solid ${LOC_COLORS[job.location_type]}30`, borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 600 }}>
                {LOC_LABELS[job.location_type]}
              </span>
              <span style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                {job.category}
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.75rem' }}>{job.title}</h1>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.88rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>💰 {formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.job_type)}</span>
              {job.location && <span>📍 {job.location}</span>}
              <span>👥 {job.applicant_count} applicant{job.applicant_count !== 1 ? 's' : ''}</span>
              {job.application_deadline && (
                <span style={{ color: new Date(job.application_deadline) < new Date() ? '#ef4444' : '#fbbf24', fontWeight: 600 }}>
                  ⏰ {daysUntil(job.application_deadline)}
                </span>
              )}
            </div>
            {job.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {job.tags.map(t => <span key={t} style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.75rem', color: '#38bdf8' }}>{t}</span>)}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, padding: '1.75rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>About the Role</h2>
            <style>{`
              .job-desc p { margin: 0 0 0.9em; }
              .job-desc ul, .job-desc ol { margin: 0 0 0.9em; padding-left: 1.5em; }
              .job-desc li { margin-bottom: 0.3em; }
              .job-desc strong, .job-desc b { color: #f1f5f9; }
              .job-desc a { color: #38bdf8; }
              .job-desc h1, .job-desc h2, .job-desc h3 { color: #f1f5f9; margin: 1em 0 0.5em; font-weight: 700; }
            `}</style>
            {job.description.includes('<') ? (
              <div
                className="job-desc"
                style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.85 }}
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            ) : (
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{job.description}</div>
            )}
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, padding: '1.75rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Requirements</h2>
              {job.requirements.includes('<') ? (
                <div
                  className="job-desc"
                  style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 2 }}
                  dangerouslySetInnerHTML={{ __html: job.requirements }}
                />
              ) : (
                <div style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 2, whiteSpace: 'pre-line' }}>{job.requirements}</div>
              )}
            </div>
          )}

          {/* About poster */}
          {job.poster && (
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, padding: '1.75rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#f1f5f9' }}>About the Employer</h2>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', flexShrink: 0 }}>
                  {(job.poster.full_name ?? 'FT').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
                    {job.poster.full_name}
                    {(job.poster.trust_balance ?? 0) > 200 && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '0.1rem 0.5rem' }}>✓ Verified</span>}
                  </div>
                  {(job.poster.trust_balance ?? 0) > 0 && <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>₮ Trust Balance: {job.poster.trust_balance}</div>}
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Member since {new Date(job.poster.created_at).getFullYear()}</div>
                  {job.poster.bio && <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>{job.poster.bio}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Similar jobs */}
          {similarJobs.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Similar Jobs</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {similarJobs.map(j => (
                  <Link key={j.id} href={`/jobs/${j.id}`} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 10, padding: '1rem 1.25rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.92rem', marginBottom: '0.3rem' }}>{j.title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{j.poster_name} · {formatSalary(j.salary_min, j.salary_max, j.salary_currency, j.job_type)}</div>
                    </div>
                    <span style={{ color: '#38bdf8', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>View →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="job-apply-sticky">
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 14, padding: '1.5rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.25rem' }}>
              {formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.job_type)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>per year</div>
            <button
              onClick={() => setShowModal(true)}
              style={{ width: '100%', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', marginBottom: '0.75rem' }}
            >
              Apply Now →
            </button>
            <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', marginBottom: '1.25rem' }}>
              ₮5 Trust earned on application
            </div>
            <div style={{ borderTop: '1px solid rgba(56,189,248,0.08)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'Job Type', value: TYPE_LABELS[job.job_type] },
                { label: 'Location', value: LOC_LABELS[job.location_type] + (job.location ? ` · ${job.location}` : '') },
                { label: 'Applicants', value: `${job.applicant_count} applied` },
                ...(job.application_deadline ? [{ label: 'Deadline', value: daysUntil(job.application_deadline) }] : []),
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>{item.label}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Application Modal */}
      {showModal && (
        <div className="job-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="job-modal">
            {applied ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>Application Submitted!</h3>
                <p style={{ color: '#64748b', marginBottom: '1.25rem' }}>Good luck! You'll hear back soon.</p>
                <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, padding: '0.75rem', marginBottom: '1.5rem' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>₮5 Trust earned</span> for applying!
                </div>
                <button onClick={() => { setShowModal(false); setApplied(false) }} style={{ width: '100%', background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Apply for {job.title}</h3>
                  <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.5rem', padding: 0, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem', display: 'block' }}>Cover Letter *</label>
                  <textarea value={form.cover_letter} onChange={e => setForm(f => ({ ...f, cover_letter: e.target.value }))} placeholder="Why are you a great fit for this role?..." rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem', display: 'block' }}>CV / Resume</label>
                  {/* Toggle */}
                  <div style={{ display: 'flex', gap: 4, background: '#0f172a', borderRadius: 8, padding: 4, marginBottom: '0.75rem' }}>
                    {(['upload', 'link'] as const).map(mode => (
                      <button key={mode} onClick={() => { setCvMode(mode); setForm(f => ({ ...f, cv_url: '' })); setCvFile(null); setCvFileName(''); setAppError('') }}
                        style={{ flex: 1, padding: '0.4rem 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: cvMode === mode ? 700 : 500, fontFamily: 'inherit', background: cvMode === mode ? '#1e293b' : 'transparent', color: cvMode === mode ? '#38bdf8' : '#64748b', transition: 'all 0.15s' }}>
                        {mode === 'upload' ? '📎 Upload File' : '🔗 Paste Link'}
                      </button>
                    ))}
                  </div>
                  {cvMode === 'upload' ? (
                    <div>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: `2px dashed ${cvFileName ? 'rgba(56,189,248,0.4)' : 'rgba(148,163,184,0.2)'}`, borderRadius: 10, padding: '1.25rem', cursor: 'pointer', background: cvFileName ? 'rgba(56,189,248,0.04)' : 'transparent', transition: 'all 0.15s' }}>
                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleCvFileChange} style={{ display: 'none' }} />
                        {cvUploading ? (
                          <>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#38bdf8', animation: 'spin 0.8s linear infinite' }} />
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Uploading…</span>
                          </>
                        ) : cvFileName ? (
                          <>
                            <span style={{ fontSize: '1.25rem' }}>✅</span>
                            <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600, textAlign: 'center', wordBreak: 'break-all' }}>{cvFileName}</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tap to replace</span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '1.5rem' }}>📄</span>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Tap to upload your CV</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>PDF or Word · max 5MB</span>
                          </>
                        )}
                      </label>
                    </div>
                  ) : (
                    <input value={form.cv_url} onChange={e => setForm(f => ({ ...f, cv_url: e.target.value }))} placeholder="https://drive.google.com/... or LinkedIn URL" style={inputStyle} />
                  )}
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem', display: 'block' }}>Portfolio URL (optional)</label>
                  <input value={form.portfolio_url} onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))} placeholder="https://..." style={inputStyle} />
                </div>
                {appError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.65rem 1rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{appError}</div>}
                <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.82rem', color: '#38bdf8', marginBottom: '1.25rem' }}>
                  ✨ You'll earn <strong>₮5 Trust</strong> for submitting this application
                </div>
                <button onClick={handleApply} disabled={submitting} style={{ width: '100%', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
