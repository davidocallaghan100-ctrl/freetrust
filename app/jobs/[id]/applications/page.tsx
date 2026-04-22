'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Applicant {
  id: string
  full_name: string | null
  avatar_url: string | null
  trust_balance: number | null
}

interface Application {
  id: string
  cover_letter: string | null
  cv_url: string | null
  portfolio_url: string | null
  status: string
  created_at: string
  applicant: Applicant | Applicant[] | null
}

type FilterTab = 'all' | 'pending' | 'shortlisted' | 'rejected' | 'hired'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: 'rgba(148,163,184,0.15)', color: '#cbd5e1', label: 'Pending' },
  reviewed:    { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8', label: 'Reviewed' },
  shortlisted: { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: '⭐ Shortlisted' },
  hired:       { bg: 'rgba(52,211,153,0.15)',  color: '#34d399', label: '✅ Hired' },
  rejected:    { bg: 'rgba(248,113,113,0.15)', color: '#f87171', label: '❌ Rejected' },
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(ms / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function resolveApplicant(raw: Applicant | Applicant[] | null): Applicant | null {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'shortlisted', label: '⭐ Shortlisted' },
  { key: 'hired', label: '✅ Hired' },
  { key: 'rejected', label: '❌ Rejected' },
]

export default function ManageApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [applications, setApplications] = useState<Application[]>([])
  const [jobTitle, setJobTitle] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/applications`, { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) { setError('Only the job poster can view applications.'); setLoading(false); return }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Failed to load'); setLoading(false); return }
      const data = await res.json() as { applications: Application[]; jobTitle: string }
      setApplications(data.applications ?? [])
      setJobTitle(data.jobTitle ?? '')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [jobId, router])

  useEffect(() => { void load() }, [load])

  async function updateStatus(appId: string, status: string) {
    setUpdatingId(appId)
    try {
      const res = await fetch(`/api/jobs/${jobId}/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Update failed')
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a))
    } catch {
      alert('Failed to update status. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = filter === 'all' ? applications : applications.filter(a => a.status === filter)

  const countFor = (tab: FilterTab) => tab === 'all' ? applications.length : applications.filter(a => a.status === tab).length

  return (
    <div style={{ minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        .app-card { background: rgba(30,41,59,0.65); border: 1px solid rgba(148,163,184,0.12); border-radius: 14px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.75rem; transition: border-color 0.15s; }
        .app-card:hover { border-color: rgba(148,163,184,0.25); }
        .app-act-btn { border: none; border-radius: 7px; padding: 0.38rem 0.85rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
        .app-act-btn:hover { opacity: 0.8; }
        .app-act-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .app-tab { background: none; border: none; padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit; color: #64748b; transition: all 0.15s; white-space: nowrap; }
        .app-tab.active { background: rgba(56,189,248,0.12); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); }
        @media (max-width: 600px) {
          .app-act-row { flex-wrap: wrap !important; }
          .app-act-btn { flex: 1 1 40%; }
        }
      `}</style>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 1rem' }}>

        {/* Header */}
        <div style={{ padding: '1.5rem 0 1.25rem' }}>
          <Link href="/jobs/manage" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 500 }}>← My Jobs</Link>
          <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.7rem)', fontWeight: 800, margin: '0.6rem 0 0.2rem', letterSpacing: '-0.3px' }}>
            {jobTitle ? `Applications: ${jobTitle}` : 'Applications'}
          </h1>
          {!loading && !error && (
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>
              {applications.length} total application{applications.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Filter tabs */}
        {!loading && !error && applications.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.5rem', background: 'rgba(30,41,59,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.1)' }}>
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                className={`app-tab${filter === tab.key ? ' active' : ''}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label} {countFor(tab.key) > 0 && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({countFor(tab.key)})</span>}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 1rem' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading applications…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#f87171', marginBottom: 12 }}>{error}</div>
            <button type="button" onClick={load} style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && applications.length === 0 && (
          <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8' }}>No applications yet</div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>Share your job to attract more candidates.</div>
            <Link href={`/jobs/${jobId}`} style={{ display: 'inline-block', marginTop: '1rem', color: '#38bdf8', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>View job posting →</Link>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && !error && applications.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
            No {filter} applications yet.
            <button onClick={() => setFilter('all')} style={{ display: 'block', margin: '0.75rem auto 0', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>Show all</button>
          </div>
        )}

        {/* Application cards */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filtered.map(app => {
              const applicant = resolveApplicant(app.applicant)
              const name = applicant?.full_name ?? 'Anonymous'
              const balance = applicant?.trust_balance ?? 0
              const st = STATUS_STYLE[app.status] ?? STATUS_STYLE.pending
              const isExpanded = expandedId === app.id
              const isUpdating = updatingId === app.id
              const coverLetterPreview = app.cover_letter
                ? (isExpanded ? app.cover_letter : app.cover_letter.slice(0, 220) + (app.cover_letter.length > 220 ? '…' : ''))
                : null

              return (
                <div key={app.id} className="app-card" style={{ opacity: isUpdating ? 0.6 : 1 }}>

                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {applicant?.avatar_url ? (
                      <img src={applicant.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/profile?id=${applicant?.id ?? ''}`} style={{ color: '#f1f5f9', textDecoration: 'none', fontWeight: 700, fontSize: '0.92rem' }}>{name}</Link>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Applied {relativeTime(app.created_at)}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>
                      ₮{balance}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: st.color, background: st.bg, padding: '2px 10px', borderRadius: 999, flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Cover letter */}
                  {coverLetterPreview && (
                    <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '0.85rem', fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {coverLetterPreview}
                      {app.cover_letter && app.cover_letter.length > 220 && (
                        <button onClick={() => setExpandedId(isExpanded ? null : app.id)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0 0 0 4px' }}>
                          {isExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Links + actions */}
                  <div className="app-act-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {app.cv_url && (
                      <a href={app.cv_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>📄 CV →</a>
                    )}
                    {app.portfolio_url && (
                      <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>🎨 Portfolio →</a>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {app.status !== 'shortlisted' && app.status !== 'hired' && (
                        <button className="app-act-btn" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                          onClick={() => updateStatus(app.id, 'shortlisted')} disabled={isUpdating}>
                          ⭐ Shortlist
                        </button>
                      )}
                      {app.status === 'shortlisted' && (
                        <button className="app-act-btn" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
                          onClick={() => updateStatus(app.id, 'hired')} disabled={isUpdating}>
                          ✅ Mark Hired
                        </button>
                      )}
                      {app.status !== 'rejected' && (
                        <button className="app-act-btn" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
                          onClick={() => updateStatus(app.id, 'rejected')} disabled={isUpdating}>
                          ❌ Reject
                        </button>
                      )}
                      <Link href={`/messages?to=${applicant?.id ?? ''}&context=job:${jobId}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 7, padding: '0.38rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textDecoration: 'none' }}>
                        💬 Message
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
