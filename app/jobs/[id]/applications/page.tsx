'use client'

import { useEffect, useState } from 'react'
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

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: 'rgba(148,163,184,0.2)', color: '#cbd5e1', label: 'Pending' },
  reviewed:    { bg: 'rgba(56,189,248,0.2)',  color: '#38bdf8', label: 'Reviewed' },
  shortlisted: { bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24', label: 'Shortlisted' },
  hired:       { bg: 'rgba(52,211,153,0.2)',  color: '#34d399', label: 'Hired' },
  rejected:    { bg: 'rgba(248,113,113,0.2)', color: '#f87171', label: 'Rejected' },
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

export default function ManageApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [applications, setApplications] = useState<Application[]>([])
  const [jobTitle, setJobTitle] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/applications`, { cache: 'no-store' })
      if (res.status === 401) { router.push('/auth/login'); return }
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
  }

  useEffect(() => { load() }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 1rem' }}>

        {/* Header */}
        <div style={{ padding: '1.5rem 0 1.25rem' }}>
          <Link href={`/jobs/${jobId}`} style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
            ← Back to job
          </Link>
          <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.7rem)', fontWeight: 800, margin: '0.75rem 0 0.25rem', letterSpacing: '-0.3px' }}>
            Applications{jobTitle ? ` for: ${jobTitle}` : ''}
          </h1>
          {!loading && !error && (
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>
              {applications.length} applicant{applications.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>
            Loading applications...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#f87171', marginBottom: 12 }}>{error}</div>
            <button
              type="button"
              onClick={load}
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && applications.length === 0 && (
          <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8' }}>No applications yet</div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>Share your job to attract more candidates.</div>
          </div>
        )}

        {/* Application cards */}
        {!loading && !error && applications.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {applications.map(app => {
              const applicant = resolveApplicant(app.applicant)
              const name = applicant?.full_name ?? 'Anonymous'
              const balance = applicant?.trust_balance ?? 0
              const st = STATUS_STYLE[app.status] ?? STATUS_STYLE.pending
              return (
                <div key={app.id} style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {applicant?.avatar_url ? (
                      <img src={applicant.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/profile?id=${applicant?.id ?? ''}`} style={{ color: '#f1f5f9', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                        {name}
                      </Link>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Applied {relativeTime(app.created_at)}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', padding: '2px 8px', borderRadius: 999 }}>
                      ₮{balance}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 999 }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Cover letter */}
                  {app.cover_letter && (
                    <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '0.85rem', fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {app.cover_letter}
                    </div>
                  )}

                  {/* Links + action row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {app.cv_url && (
                      <a href={app.cv_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                        View CV →
                      </a>
                    )}
                    {app.portfolio_url && (
                      <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                        View Portfolio →
                      </a>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <Link
                        href={`/messages?to=${applicant?.id ?? ''}&context=job:${jobId}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 8, padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, color: '#34d399', textDecoration: 'none' }}
                      >
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
