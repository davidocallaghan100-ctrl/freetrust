'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Application {
  id: string
  job_id: string
  created_at: string
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired'
  cover_letter: string | null
  job?: { title: string; job_type: string; location_type: string; poster?: { full_name: string | null } }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  reviewed:    { label: 'Reviewed',    color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  shortlisted: { label: 'Shortlisted', color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  rejected:    { label: 'Rejected',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
  hired:       { label: '🎉 Hired!',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
}

const TYPE_LABELS: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', freelance: 'Freelance' }
const LOC_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', on_site: 'On-Site' }


function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff} days ago`
}

export default function MyApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setApps([]); setLoading(false); return }

        const { data } = await supabase
          .from('job_applications')
          .select('*, job:jobs(title, job_type, location_type, poster:profiles!poster_id(full_name))')
          .eq('applicant_id', user.id)
          .order('created_at', { ascending: false })

        setApps(data ? (data as Application[]) : [])
      } catch {
        setApps([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        @media (max-width: 768px) {
          .my-apps-inner { padding: 1rem !important; }
          .my-apps-card-footer { flex-direction: column !important; gap: 0.75rem !important; }
          .my-apps-card-footer a { width: 100% !important; text-align: center !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2rem 1.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.35rem' }}>My Applications</h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Track your job applications in one place</p>
            </div>
            <Link href="/jobs" style={{ background: 'transparent', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
              Browse Jobs
            </Link>
          </div>
        </div>
      </div>

      <div className="my-apps-inner" style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading applications...</div>
        ) : apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>📋</div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>No applications yet</h3>
            <p style={{ color: '#64748b', marginBottom: '1.75rem' }}>Start applying to jobs and track your progress here</p>
            <Link href="/jobs" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
              Browse Jobs →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {apps.length} application{apps.length !== 1 ? 's' : ''} · {apps.filter(a => a.status === 'shortlisted').length} shortlisted · {apps.filter(a => a.status === 'hired').length} hired
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {apps.map(app => {
                const st = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending
                return (
                  <div key={app.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.3rem' }}>{app.job?.title ?? 'Job Title'}</h3>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          {app.job?.poster?.full_name ?? 'Employer'}
                          {app.job?.job_type && ` · ${TYPE_LABELS[app.job.job_type]}`}
                          {app.job?.location_type && ` · ${LOC_LABELS[app.job.location_type]}`}
                        </div>
                      </div>
                      <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30`, borderRadius: 999, padding: '0.25rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </div>

                    {/* Progress indicator */}
                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
                      {(['pending', 'reviewed', 'shortlisted', 'hired'] as const).map((s, i) => {
                        const statuses = ['pending', 'reviewed', 'shortlisted', 'hired']
                        const currentIdx = statuses.indexOf(app.status)
                        const isActive = i <= currentIdx && app.status !== 'rejected'
                        return (
                          <div key={s} style={{ flex: 1, height: 3, borderRadius: 999, background: isActive ? '#38bdf8' : 'rgba(56,189,248,0.15)', transition: 'background 0.2s' }} />
                        )
                      })}
                    </div>

                    <div className="my-apps-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#475569' }}>Applied {timeAgo(app.created_at)}</span>
                      <Link href={`/jobs/${app.job_id}`} style={{ background: 'transparent', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 7, padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                        View Job →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
