'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ManagedJob {
  id: string
  title: string
  job_type: string
  location_type: string
  location: string | null
  status: string
  applicant_count: number
  created_at: string
  company_name: string | null
  company_logo_url: string | null
  org_id: string | null
  org?: { name: string; logo_url: string | null } | null
}

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time',
  contract: 'Contract', freelance: 'Freelance', internship: 'Internship',
}
const TYPE_COLORS: Record<string, string> = {
  full_time: '#38bdf8', part_time: '#a78bfa',
  contract: '#fbbf24', freelance: '#34d399', internship: '#fb923c',
}
const LOC_LABELS: Record<string, string> = {
  remote: '🌍 Remote', hybrid: '🔀 Hybrid', on_site: '🏢 On-site',
}
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:  { label: 'Active',  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  dot: '🟢' },
  paused:  { label: 'Paused',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  dot: '🟡' },
  closed:  { label: 'Closed',  color: '#f87171', bg: 'rgba(248,113,113,0.12)', dot: '🔴' },
  filled:  { label: 'Filled',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', dot: '🟣' },
  draft:   { label: 'Draft',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', dot: '⚪' },
}

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

function getInitials(name: string | null): string {
  if (!name) return 'J'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function MyJobsDashboard() {
  const router = useRouter()
  const [jobs, setJobs] = useState<ManagedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/jobs/manage'); return }
      setUserId(user.id)

      const res = await fetch(`/api/jobs?posterId=${user.id}&limit=100&status=all`)
      if (!res.ok) throw new Error('Failed to load jobs')
      const data = await res.json() as { jobs: ManagedJob[] }
      setJobs(data.jobs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [openMenuId])

  async function updateStatus(jobId: string, status: string) {
    setUpdatingId(jobId)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Update failed')
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j))
    } catch {
      alert('Failed to update job status. Please try again.')
    } finally {
      setUpdatingId(null)
      setOpenMenuId(null)
    }
  }

  async function deleteJob(jobId: string) {
    setUpdatingId(jobId)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setJobs(prev => prev.filter(j => j.id !== jobId))
    } catch {
      alert('Failed to delete job. Please try again.')
    } finally {
      setUpdatingId(null)
      setConfirmDelete(null)
    }
  }

  const activeCount = jobs.filter(j => j.status === 'active').length
  const totalApplicants = jobs.reduce((s, j) => s + (j.applicant_count ?? 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        .mj-card { background: rgba(30,41,59,0.7); border: 1px solid rgba(148,163,184,0.12); border-radius: 16px; padding: 1.25rem; transition: border-color 0.15s; }
        .mj-card:hover { border-color: rgba(56,189,248,0.25); }
        .mj-btn { border: none; border-radius: 8px; padding: 0.45rem 1rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.15s; display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
        .mj-btn:hover { opacity: 0.85; }
        .mj-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mj-menu-item { display: block; width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 1rem; font-size: 0.82rem; color: #cbd5e1; cursor: pointer; font-family: inherit; border-radius: 6px; }
        .mj-menu-item:hover { background: rgba(148,163,184,0.1); }
        @media (max-width: 640px) {
          .mj-actions { flex-direction: column !important; }
          .mj-actions .mj-btn { width: 100%; justify-content: center; }
          .mj-stats { flex-wrap: wrap; }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.75rem 0 1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <Link href="/jobs" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 500 }}>← Back to Jobs</Link>
            <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, margin: '0.5rem 0 0.25rem', letterSpacing: '-0.3px' }}>My Jobs</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>Manage your job postings and review applications</p>
          </div>
          <Link href="/jobs/new" style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 10, padding: '0.65rem 1.35rem', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            + Post a Job
          </Link>
        </div>

        {/* Stats bar */}
        {!loading && jobs.length > 0 && (
          <div className="mj-stats" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Jobs', value: jobs.length, color: '#38bdf8' },
              { label: 'Active', value: activeCount, color: '#34d399' },
              { label: 'Total Applicants', value: totalApplicants, color: '#a78bfa' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '0.85rem 1.25rem', flex: '1 1 120px', minWidth: 100 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#64748b' }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 1rem' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading your jobs…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: '#f87171' }}>
            {error}
            <button onClick={load} className="mj-btn" style={{ background: 'rgba(248,113,113,0.15)', color: '#fca5a5', marginLeft: '1rem' }}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && jobs.length === 0 && (
          <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 16, padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💼</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No jobs posted yet</div>
            <div style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Post your first job to start receiving applications from FreeTrust members.</div>
            <Link href="/jobs/new" style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 10, padding: '0.7rem 1.5rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
              + Post a Job
            </Link>
          </div>
        )}

        {/* Job cards */}
        {!loading && !error && jobs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {jobs.map(job => {
              const st = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.draft
              const typeColor = TYPE_COLORS[job.job_type] ?? '#94a3b8'
              const typeLabel = TYPE_LABELS[job.job_type] ?? job.job_type
              const locLabel = LOC_LABELS[job.location_type] ?? job.location_type
              const displayName = job.company_name ?? 'Your Job'
              const logo = job.company_logo_url ?? null
              const isUpdating = updatingId === job.id

              return (
                <div key={job.id} className="mj-card" style={{ opacity: isUpdating ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>

                    {/* Logo */}
                    <div style={{ flexShrink: 0 }}>
                      {logo ? (
                        <img src={logo} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(148,163,184,0.15)' }} />
                      ) : (
                        <div style={{ width: 52, height: 52, borderRadius: 10, background: 'linear-gradient(135deg,#1e3a5f,#0f172a)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                          {getInitials(displayName)}
                        </div>
                      )}
                    </div>

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.2rem', color: '#f1f5f9' }}>{job.title}</h3>
                          {displayName && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{displayName}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {/* Status badge */}
                          <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30`, borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            {st.dot} {st.label}
                          </span>
                          {/* Three-dot menu */}
                          <div style={{ position: 'relative' }}>
                            <button
                              className="mj-btn"
                              style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8', padding: '0.35rem 0.55rem', borderRadius: 7 }}
                              onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === job.id ? null : job.id) }}
                              disabled={isUpdating}
                            >
                              ⋯
                            </button>
                            {openMenuId === job.id && (
                              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '110%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, padding: '0.35rem', zIndex: 50, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                {job.status !== 'active'  && <button className="mj-menu-item" onClick={() => updateStatus(job.id, 'active')}>🟢 Set Active</button>}
                                {job.status !== 'paused'  && <button className="mj-menu-item" onClick={() => updateStatus(job.id, 'paused')}>🟡 Pause</button>}
                                {job.status !== 'closed'  && <button className="mj-menu-item" onClick={() => updateStatus(job.id, 'closed')}>🔴 Close</button>}
                                <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0.35rem 0' }} />
                                <button className="mj-menu-item" style={{ color: '#f87171' }} onClick={() => { setOpenMenuId(null); setConfirmDelete(job.id) }}>🗑 Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Badges */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.6rem 0' }}>
                        <span style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>{typeLabel}</span>
                        <span style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>{locLabel}</span>
                        {job.location && <span style={{ background: 'rgba(148,163,184,0.06)', color: '#64748b', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem' }}>📍 {job.location}</span>}
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#64748b', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                        <span>👥 <strong style={{ color: '#94a3b8' }}>{job.applicant_count ?? 0}</strong> applicant{job.applicant_count !== 1 ? 's' : ''}</span>
                        <span>📅 Posted <strong style={{ color: '#94a3b8' }}>{daysAgo(job.created_at)}</strong></span>
                      </div>

                      {/* Action buttons */}
                      <div className="mj-actions" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <Link href={`/jobs/${job.id}/applications`} className="mj-btn" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', textDecoration: 'none' }}>
                          👥 View Applications {job.applicant_count > 0 && <span style={{ background: '#a78bfa', color: '#0f172a', borderRadius: 999, padding: '0 6px', fontSize: '0.7rem', fontWeight: 800 }}>{job.applicant_count}</span>}
                        </Link>
                        <Link href={`/jobs/${job.id}/edit`} className="mj-btn" style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', textDecoration: 'none' }}>
                          ✏️ Edit Job
                        </Link>
                        <Link href={`/jobs/${job.id}`} className="mj-btn" style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)', textDecoration: 'none' }}>
                          👁 View
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 16, padding: '1.75rem', maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗑</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>Delete this job?</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>This will permanently delete the job posting and all its applications. This cannot be undone.</div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="mj-btn" style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="mj-btn" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }} onClick={() => deleteJob(confirmDelete)} disabled={updatingId === confirmDelete}>
                {updatingId === confirmDelete ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
