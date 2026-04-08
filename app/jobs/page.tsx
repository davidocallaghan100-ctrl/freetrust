'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type JobType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'all'
type LocationType = 'remote' | 'hybrid' | 'on_site' | 'all'

interface Job {
  id: string
  title: string
  description: string
  job_type: string
  location_type: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  category: string
  tags: string[]
  created_at: string
  applicant_count: number
  poster?: { full_name: string | null; trust_score?: number }
}

const MOCK_JOBS: Job[] = [
  { id: '1', title: 'Senior Full-Stack Engineer', description: 'Build core product features.', job_type: 'full_time', location_type: 'remote', location: null, salary_min: 70000, salary_max: 95000, salary_currency: 'GBP', category: 'Tech', tags: ['React', 'Node.js', 'TypeScript'], created_at: new Date(Date.now() - 1 * 86400000).toISOString(), applicant_count: 24, poster: { full_name: 'SaaS Builders Co', trust_score: 312 } },
  { id: '2', title: 'UX/UI Designer', description: 'Design beautiful product experiences.', job_type: 'contract', location_type: 'hybrid', location: 'London, UK', salary_min: 45000, salary_max: 60000, salary_currency: 'GBP', category: 'Design', tags: ['Figma', 'User Research', 'Prototyping'], created_at: new Date(Date.now() - 2 * 86400000).toISOString(), applicant_count: 18, poster: { full_name: 'Design Collective', trust_score: 189 } },
  { id: '3', title: 'Marketing Manager', description: 'Lead growth marketing initiatives.', job_type: 'full_time', location_type: 'on_site', location: 'Dublin, Ireland', salary_min: 50000, salary_max: 65000, salary_currency: 'GBP', category: 'Marketing', tags: ['SEO', 'Paid Ads', 'Content'], created_at: new Date(Date.now() - 3 * 86400000).toISOString(), applicant_count: 31, poster: { full_name: 'GrowthOps Ltd', trust_score: 247 } },
  { id: '4', title: 'Freelance Copywriter', description: 'Write compelling brand and product copy.', job_type: 'freelance', location_type: 'remote', location: null, salary_min: 300, salary_max: 600, salary_currency: 'GBP', category: 'Marketing', tags: ['Copywriting', 'Brand', 'B2B'], created_at: new Date(Date.now() - 4 * 86400000).toISOString(), applicant_count: 12, poster: { full_name: 'Impact Agency', trust_score: 156 } },
  { id: '5', title: 'Head of Sales', description: 'Scale revenue across EMEA.', job_type: 'full_time', location_type: 'hybrid', location: 'Manchester, UK', salary_min: 80000, salary_max: 110000, salary_currency: 'GBP', category: 'Sales', tags: ['B2B', 'SaaS', 'Enterprise'], created_at: new Date(Date.now() - 5 * 86400000).toISOString(), applicant_count: 9, poster: { full_name: 'Enterprise Scale', trust_score: 421 } },
  { id: '6', title: 'Data Analyst', description: 'Turn data into business insights.', job_type: 'part_time', location_type: 'remote', location: null, salary_min: 30000, salary_max: 40000, salary_currency: 'GBP', category: 'Finance', tags: ['SQL', 'Python', 'Tableau'], created_at: new Date(Date.now() - 6 * 86400000).toISOString(), applicant_count: 7, poster: { full_name: 'DataDriven Ltd', trust_score: 203 } },
  { id: '7', title: 'Sustainability Consultant', description: 'Help organisations measure ESG impact.', job_type: 'contract', location_type: 'hybrid', location: 'Bristol, UK', salary_min: 55000, salary_max: 75000, salary_currency: 'GBP', category: 'Operations', tags: ['ESG', 'Reporting', 'Strategy'], created_at: new Date(Date.now() - 8 * 86400000).toISOString(), applicant_count: 15, poster: { full_name: 'GreenWorks Advisory', trust_score: 378 } },
  { id: '8', title: 'Electrician — Renewable Projects', description: 'Install solar and EV infrastructure.', job_type: 'full_time', location_type: 'on_site', location: 'Birmingham, UK', salary_min: 40000, salary_max: 52000, salary_currency: 'GBP', category: 'Trades', tags: ['Electrical', 'Solar', 'EV'], created_at: new Date(Date.now() - 10 * 86400000).toISOString(), applicant_count: 5, poster: { full_name: 'SolarTrades UK', trust_score: 94 } },
]

const TYPE_LABELS: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', freelance: 'Freelance' }
const TYPE_COLORS: Record<string, string> = { full_time: '#38bdf8', part_time: '#a78bfa', contract: '#fbbf24', freelance: '#34d399' }
const LOC_COLORS: Record<string, string> = { remote: '#34d399', hybrid: '#38bdf8', on_site: '#fb923c' }
const LOC_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', on_site: 'On-Site' }
const SALARY_FILTERS = [
  { label: 'Any', min: 0 }, { label: '£20k+', min: 20000 }, { label: '£40k+', min: 40000 },
  { label: '£60k+', min: 60000 }, { label: '£80k+', min: 80000 },
]
const CATEGORIES = ['All', 'Tech', 'Design', 'Marketing', 'Sales', 'Finance', 'Operations', 'Trades', 'Other']

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff}d ago`
}

function formatSalary(min: number | null, max: number | null, currency: string, type: string) {
  if (!min && !max) return 'Competitive'
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
  const isDaily = type === 'freelance' && (min ?? 0) < 2000
  const fmt = (n: number) => isDaily ? `${sym}${n}/day` : n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS)
  const [search, setSearch] = useState('')
  const [jobType, setJobType] = useState<JobType>('all')
  const [locType, setLocType] = useState<LocationType>('all')
  const [category, setCategory] = useState('All')
  const [salaryMin, setSalaryMin] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('jobs')
          .select('*, poster:profiles!poster_id(full_name)')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50)
        if (data && data.length > 0) setJobs(data as Job[])
      } catch { /* fall back to mock */ }
    }
    load()
  }, [])

  const filtered = jobs.filter(j => {
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.description.toLowerCase().includes(search.toLowerCase())) return false
    if (jobType !== 'all' && j.job_type !== jobType) return false
    if (locType !== 'all' && j.location_type !== locType) return false
    if (category !== 'All' && j.category !== category) return false
    if (salaryMin > 0 && (j.salary_max ?? 0) < salaryMin && (j.salary_min ?? 0) < salaryMin) return false
    return true
  })

  const btnBase: React.CSSProperties = { padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontWeight: 500, transition: 'all 0.15s' }
  const btnActive: React.CSSProperties = { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .jobs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
        .jobs-filters { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; align-items: center; }
        .jobs-filter-label { font-size: 0.75rem; color: #64748b; font-weight: 600; margin-right: 0.25rem; white-space: nowrap; }
        @media (max-width: 768px) {
          .jobs-grid { grid-template-columns: 1fr; }
          .jobs-hero-inner { flex-direction: column !important; align-items: stretch !important; }
          .jobs-hero-inner input { width: 100% !important; }
          .jobs-hero-inner button { width: 100% !important; margin-top: 0.5rem; }
          .jobs-filters { gap: 0.3rem; }
        }
      `}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Jobs</h1>
              <p style={{ color: '#64748b' }}>Find your next opportunity in the trust economy</p>
            </div>
            <Link href="/jobs/new" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.6rem 1.3rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}>
              + Post a Job
            </Link>
          </div>
          <div className="jobs-hero-inner" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search job title or keyword..."
              style={{ flex: 1, maxWidth: 480, background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 1rem', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
            />
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
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
            <span className="jobs-filter-label">Location:</span>
            {(['all', 'remote', 'hybrid', 'on_site'] as LocationType[]).map(l => (
              <button key={l} onClick={() => setLocType(l)} style={{ ...btnBase, ...(locType === l ? btnActive : {}) }}>
                {l === 'all' ? 'All' : LOC_LABELS[l]}
              </button>
            ))}
          </div>
          <div className="jobs-filters">
            <span className="jobs-filter-label">Category:</span>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{ ...btnBase, ...(category === c ? btnActive : {}) }}>{c}</button>
            ))}
          </div>
          <div className="jobs-filters">
            <span className="jobs-filter-label">Salary:</span>
            {SALARY_FILTERS.map(s => (
              <button key={s.label} onClick={() => setSalaryMin(s.min)} style={{ ...btnBase, ...(salaryMin === s.min ? btnActive : {}) }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#94a3b8' }}>No jobs match your filters</div>
            <div>Try adjusting your search or filters</div>
          </div>
        ) : (
          <div className="jobs-grid">
            {filtered.map(job => (
              <div key={job.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', transition: 'border-color 0.15s' }}>
                {/* Poster */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', color: '#0f172a', flexShrink: 0 }}>
                      {(job.poster?.full_name ?? 'FT').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>{job.poster?.full_name ?? 'FreeTrust Member'}</div>
                      {(job.poster?.trust_score ?? 0) > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          ⭐ {job.poster?.trust_score}
                          {(job.poster?.trust_score ?? 0) > 200 && <span style={{ marginLeft: '0.35rem', color: '#38bdf8', fontWeight: 600 }}>✓ Verified</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>{daysAgo(job.created_at)}</span>
                </div>

                {/* Title + badges */}
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem', lineHeight: 1.3 }}>{job.title}</h3>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ background: `${TYPE_COLORS[job.job_type]}18`, color: TYPE_COLORS[job.job_type], border: `1px solid ${TYPE_COLORS[job.job_type]}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
                      {TYPE_LABELS[job.job_type]}
                    </span>
                    <span style={{ background: `${LOC_COLORS[job.location_type]}18`, color: LOC_COLORS[job.location_type], border: `1px solid ${LOC_COLORS[job.location_type]}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
                      {LOC_LABELS[job.location_type]}
                    </span>
                  </div>
                </div>

                {/* Location + Salary */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                  {(job.location_type !== 'remote' && job.location) && (
                    <span>📍 {job.location}</span>
                  )}
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                    💰 {formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.job_type)}
                  </span>
                </div>

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
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>{job.applicant_count} applicant{job.applicant_count !== 1 ? 's' : ''}</span>
                  <Link href={`/jobs/${job.id}`} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 7, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
                    Apply Now →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
