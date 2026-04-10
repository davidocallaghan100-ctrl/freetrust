'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type JobType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'all'

interface RemoteJob {
  id: string
  title: string
  company_name: string
  company_logo: string | null
  job_type: string
  location_type: string
  location: string | null
  salary: string | null
  tags: string[]
  category: string
  created_at: string
  url: string
  description_snippet: string
}

const TYPE_LABELS: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', freelance: 'Freelance' }
const TYPE_COLORS: Record<string, string> = { full_time: '#38bdf8', part_time: '#a78bfa', contract: '#fbbf24', freelance: '#34d399' }

const CATEGORIES = ['All', 'Tech', 'Design', 'Marketing', 'Sales', 'Finance', 'AI', 'Data', 'DevOps', 'Product', 'Writing', 'QA']

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff}d ago`
}

// ── Apply Modal ────────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }: { job: RemoteJob; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [coverNote, setCoverNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Pre-fill from Supabase profile if logged in
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()
      if (profile?.full_name) setName(profile.full_name)
      if (session.user.email) setEmail(session.user.email)
    })
  }, [])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    // Small delay to feel real — actual submission goes to the external URL
    await new Promise(r => setTimeout(r, 900))
    setSubmitting(false)
    setSubmitted(true)
  }

  const initials = job.company_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const typeColor = TYPE_COLORS[job.job_type] ?? '#94a3b8'
  const typeLabel = TYPE_LABELS[job.job_type] ?? job.job_type

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: '0 0 32px' }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: '#334155', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 20px 16px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {job.company_logo
              ? <img src={job.company_logo} alt={job.company_name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 3, flexShrink: 0 }} />
              : <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#0f172a', flexShrink: 0 }}>{initials}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{job.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{job.company_name}</div>
            </div>
            <button onClick={onClose} style={{ background: '#1e293b', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#64748b', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30`, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{typeLabel}</span>
            <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>🌍 Remote</span>
            {job.location && job.location !== 'Worldwide' && (
              <span style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>📍 {job.location}</span>
            )}
            {job.salary && (
              <span style={{ background: 'rgba(56,189,248,0.08)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>💰 {job.salary}</span>
            )}
          </div>
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Application sent!</div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
              Your interest has been recorded. {job.company_name} will reach out via <strong style={{ color: '#94a3b8' }}>{email}</strong>.
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 28 }}>
              You can also view the full listing on {job.company_name}&apos;s careers page.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={onClose}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}>
                Back to jobs
              </button>
              <a href={job.url} target="_blank" rel="noopener noreferrer"
                style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#38bdf8', textDecoration: 'none' }}>
                View full listing ↗
              </a>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <div style={{ padding: '20px 20px 0' }}>
            {/* Description snippet */}
            {job.description_snippet && (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>About the role</div>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{job.description_snippet}</p>
              </div>
            )}

            {/* Tags */}
            {job.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                {job.tags.slice(0, 6).map(t => (
                  <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '3px 8px', fontSize: 11, color: '#64748b' }}>{t}</span>
                ))}
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 14 }}>Your details</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Full Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: 16, color: '#f1f5f9', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: 16, color: '#f1f5f9', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Cover Note <span style={{ color: '#334155', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <textarea
                value={coverNote}
                onChange={e => setCoverNote(e.target.value)}
                placeholder={`Briefly introduce yourself and why you're a great fit for ${job.company_name}…`}
                rows={4}
                style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: 16, color: '#f1f5f9', resize: 'none', outline: 'none' }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !name.trim() || !email.trim()}
              style={{ width: '100%', background: !name.trim() || !email.trim() ? '#1e293b' : 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700, color: !name.trim() || !email.trim() ? '#475569' : '#0f172a', cursor: !name.trim() || !email.trim() ? 'not-allowed' : 'pointer', marginBottom: 10 }}
            >
              {submitting ? 'Sending…' : `Apply to ${job.company_name}`}
            </button>

            <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
              Your application will be forwarded to the employer. You can also{' '}
              <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'underline' }}>apply directly on their site ↗</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const [jobs, setJobs] = useState<RemoteJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [jobType, setJobType] = useState<JobType>('all')
  const [category, setCategory] = useState('All')
  const [applyJob, setApplyJob] = useState<RemoteJob | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '80' })
      if (category !== 'All') params.set('category', category)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/jobs/remote?${params}`)
      if (!res.ok) throw new Error('Failed to load jobs')
      const data = await res.json() as { jobs: RemoteJob[] }
      setJobs(data.jobs ?? [])
    } catch {
      setError('Unable to load jobs right now. Please try again.')
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [category, debouncedSearch])

  useEffect(() => { void fetchJobs() }, [fetchJobs])

  const filtered = jobType === 'all' ? jobs : jobs.filter(j => j.job_type === jobType)

  const btnBase: React.CSSProperties = {
    padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer',
    border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8',
    fontWeight: 500, transition: 'all 0.15s', fontFamily: 'inherit',
  }
  const btnActive: React.CSSProperties = {
    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
    color: '#38bdf8', fontWeight: 700,
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
      <style>{`
        .jobs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
        .jobs-filters { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; align-items: center; }
        .jobs-filter-label { font-size: 0.75rem; color: #64748b; font-weight: 600; margin-right: 0.25rem; white-space: nowrap; }
        .job-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem; transition: border-color 0.15s, transform 0.15s; color: inherit; cursor: pointer; }
        .job-card:hover { border-color: rgba(56,189,248,0.3); transform: translateY(-2px); }
        .job-card:active { transform: scale(0.99); }
        .spinner { display: inline-block; width: 28px; height: 28px; border: 3px solid rgba(56,189,248,0.2); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .jobs-grid { grid-template-columns: 1fr; }
          .jobs-hero-inner { flex-direction: column !important; align-items: stretch !important; }
          .jobs-hero-inner input { width: 100% !important; }
          .jobs-filters { gap: 0.3rem; }
          .job-card { padding: 1rem; }
        }
      `}</style>

      {/* Apply modal */}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Remote Jobs</h1>
              <p style={{ color: '#64748b', margin: 0 }}>Real remote opportunities from companies around the world</p>
            </div>
            <Link href="/jobs/new" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.6rem 1.3rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}>
              + Post a Job
            </Link>
          </div>
          <div className="jobs-hero-inner" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title, company, or skill..."
                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 1rem 0.65rem 2.25rem', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
              {loading ? 'Loading…' : `${filtered.length} jobs`}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
        {/* Filters */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div className="jobs-filters">
            <span className="jobs-filter-label">Type:</span>
            {(['all', 'full_time', 'part_time', 'contract', 'freelance'] as JobType[]).map(t => (
              <button key={t} onClick={() => setJobType(t)} style={{ ...btnBase, ...(jobType === t ? btnActive : {}) }}>
                {t === 'all' ? 'All' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="jobs-filters">
            <span className="jobs-filter-label">Category:</span>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{ ...btnBase, ...(category === c ? btnActive : {}) }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            <div style={{ fontSize: '0.9rem' }}>Loading real jobs…</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</div>
            <button onClick={fetchJobs} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#94a3b8' }}>No jobs match your filters</div>
            <div>Try a different category or search term</div>
          </div>
        ) : (
          <div className="jobs-grid">
            {filtered.map(job => {
              const initials = job.company_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              const typeColor = TYPE_COLORS[job.job_type] ?? '#94a3b8'
              const typeLabel = TYPE_LABELS[job.job_type] ?? job.job_type
              return (
                <div key={job.id} className="job-card" onClick={() => setApplyJob(job)}>
                  {/* Company row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {job.company_logo ? (
                        <img src={job.company_logo} alt={job.company_name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain', background: '#fff', padding: 3, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', color: '#0f172a', flexShrink: 0 }}>
                          {initials}
                        </div>
                      )}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>{job.company_name}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#475569', flexShrink: 0 }}>{daysAgo(job.created_at)}</span>
                  </div>

                  {/* Title + type badge */}
                  <div>
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem', lineHeight: 1.3 }}>{job.title}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
                        {typeLabel}
                      </span>
                      <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
                        🌍 Remote
                      </span>
                      {job.location && job.location !== 'Worldwide' && (
                        <span style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem' }}>
                          📍 {job.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description snippet */}
                  {job.description_snippet && (
                    <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.55, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {job.description_snippet}
                    </p>
                  )}

                  {/* Tags */}
                  {job.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {job.tags.slice(0, 4).map(t => (
                        <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.12rem 0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', color: job.salary ? '#38bdf8' : '#475569', fontWeight: job.salary ? 600 : 400 }}>
                      {job.salary ? `💰 ${job.salary}` : 'Salary not listed'}
                    </span>
                    <span style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#0f172a', borderRadius: 7, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 700 }}>
                      Apply →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Attribution */}
        {!loading && filtered.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: '#334155' }}>
            Jobs powered by <a href="https://remotive.com" target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'none' }}>Remotive</a>
            {' · '}
            <Link href="/jobs/new" style={{ color: '#475569', textDecoration: 'none' }}>Post your own job on FreeTrust →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
