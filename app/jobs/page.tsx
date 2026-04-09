'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

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

export default function JobsPage() {
  const [jobs, setJobs] = useState<RemoteJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [jobType, setJobType] = useState<JobType>('all')
  const [category, setCategory] = useState('All')

  // Debounce search
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

  useEffect(() => {
    void fetchJobs()
  }, [fetchJobs])

  // Client-side job type filter (Remotive doesn't filter by type server-side reliably)
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
        .job-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem; transition: border-color 0.15s, transform 0.15s; text-decoration: none; color: inherit; cursor: pointer; }
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

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Remote Jobs</h1>
              <p style={{ color: '#64748b' }}>Real remote opportunities from companies around the world</p>
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
                <a key={job.id} href={job.url} target="_blank" rel="noopener noreferrer" className="job-card">
                  {/* Company row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {job.company_logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
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
                    <span style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 7, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 700 }}>
                      Apply →
                    </span>
                  </div>
                </a>
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
