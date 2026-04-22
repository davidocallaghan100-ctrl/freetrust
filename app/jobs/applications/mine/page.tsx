'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AppStatus = 'pending' | 'reviewed' | 'shortlisted' | 'hired' | 'rejected'
type FilterTab = 'all' | AppStatus

interface JobApplication {
  id: string
  status: AppStatus
  cover_letter: string
  cv_url: string | null
  portfolio_url: string | null
  created_at: string
  job: {
    id: string
    title: string
    company_name: string | null
    company_logo_url: string | null
    job_type: string
    location_type: string
    location: string | null
    poster_id: string
    status: string
  } | null
}

interface Stats {
  total: number
  pending: number
  reviewed: number
  shortlisted: number
  hired: number
  rejected: number
}

const STATUS_CONFIG: Record<AppStatus, { label: string; emoji: string; color: string; bg: string; border: string; message?: string }> = {
  pending:     { label: 'Pending',     emoji: '⏳', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)' },
  reviewed:    { label: 'Reviewed',    emoji: '👀', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.3)' },
  shortlisted: { label: 'Shortlisted', emoji: '⭐', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', message: "🎉 You've been shortlisted!" },
  hired:       { label: 'Hired',       emoji: '✅', color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)', message: '🏆 You got the job!' },
  rejected:    { label: 'Rejected',    emoji: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.3)', message: 'Keep going — the right opportunity is out there.' },
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', freelance: 'Freelance',
}
const JOB_TYPE_COLORS: Record<string, string> = {
  full_time: '#38bdf8', part_time: '#a78bfa', contract: '#fbbf24', freelance: '#34d399',
}
const LOC_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  remote:  { emoji: '🌍', label: 'Remote',  color: '#34d399' },
  hybrid:  { emoji: '🔀', label: 'Hybrid',  color: '#a78bfa' },
  on_site: { emoji: '🏢', label: 'On-site', color: '#fb923c' },
}

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

function ApplicationCard({ app }: { app: JobApplication }) {
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending
  const job = app.job
  const preview = app.cover_letter?.slice(0, 120) ?? ''
  const hasMore = (app.cover_letter?.length ?? 0) > 120

  const jobTypeBadge = job?.job_type ? JOB_TYPE_LABELS[job.job_type] ?? job.job_type : null
  const jobTypeColor = job?.job_type ? JOB_TYPE_COLORS[job.job_type] ?? '#64748b' : '#64748b'
  const locBadge = job?.location_type ? LOC_LABELS[job.location_type] : null

  return (
    <div style={{
      background: '#1e293b',
      border: `1px solid ${app.status === 'hired' ? 'rgba(52,211,153,0.3)' : app.status === 'shortlisted' ? 'rgba(167,139,250,0.3)' : 'rgba(148,163,184,0.12)'}`,
      borderRadius: 12,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
    }}>
      {/* Top row — logo, title, status */}
      <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
        {/* Company logo / placeholder */}
        <div style={{
          width: 48, height: 48, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8',
        }}>
          {job?.company_logo_url
            ? <img src={job.company_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (job?.company_name?.[0] ?? 'J').toUpperCase()
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div>
              {job
                ? <Link href={`/jobs/${job.id}`} style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' }}>{job.title}</Link>
                : <span style={{ fontSize: '1rem', fontWeight: 700, color: '#64748b' }}>Job no longer available</span>
              }
              {job?.company_name && (
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{job.company_name}</div>
              )}
            </div>
            {/* Status badge */}
            <span style={{
              background: status.bg, color: status.color, border: `1px solid ${status.border}`,
              borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {status.emoji} {status.label}
            </span>
          </div>

          {/* Pills row */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
            {jobTypeBadge && (
              <span style={{ background: `${jobTypeColor}18`, color: jobTypeColor, border: `1px solid ${jobTypeColor}40`, borderRadius: 999, padding: '0.1rem 0.55rem', fontSize: '0.72rem', fontWeight: 600 }}>
                {jobTypeBadge}
              </span>
            )}
            {locBadge && (
              <span style={{ background: `${locBadge.color}18`, color: locBadge.color, border: `1px solid ${locBadge.color}40`, borderRadius: 999, padding: '0.1rem 0.55rem', fontSize: '0.72rem', fontWeight: 600 }}>
                {locBadge.emoji} {locBadge.label}
              </span>
            )}
            <span style={{ color: '#475569', fontSize: '0.72rem' }}>Applied {daysAgo(app.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Celebratory / sympathetic message for notable statuses */}
      {status.message && (
        <div style={{
          background: status.bg, border: `1px solid ${status.border}`,
          borderRadius: 8, padding: '0.6rem 0.85rem',
          color: status.color, fontSize: '0.85rem', fontWeight: 600,
        }}>
          {status.message}
        </div>
      )}

      {/* Cover letter preview */}
      {app.cover_letter && (
        <div style={{ fontSize: '0.83rem', color: '#94a3b8', lineHeight: 1.5 }}>
          {expanded ? app.cover_letter : preview}
          {hasMore && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
              fontSize: '0.83rem', padding: '0 0.25rem', fontFamily: 'inherit',
            }}>
              {expanded ? ' Show less' : '...read more'}
            </button>
          )}
        </div>
      )}

      {/* Links — CV, Portfolio */}
      {(app.cv_url || app.portfolio_url) && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {app.cv_url && (
            <a href={app.cv_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#38bdf8', textDecoration: 'none' }}>
              📄 CV / Resume
            </a>
          )}
          {app.portfolio_url && (
            <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#38bdf8', textDecoration: 'none' }}>
              🔗 Portfolio
            </a>
          )}
        </div>
      )}

      {/* Action buttons */}
      {job && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          <Link
            href={`/messages/new?userId=${job.poster_id}`}
            style={{
              background: 'rgba(56,189,248,0.1)', color: '#38bdf8',
              border: '1px solid rgba(56,189,248,0.2)', borderRadius: 7,
              padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 600,
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            💬 Message Poster
          </Link>
          <Link
            href={`/jobs/${job.id}`}
            style={{
              background: 'transparent', color: '#94a3b8',
              border: '1px solid rgba(148,163,184,0.2)', borderRadius: 7,
              padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 600,
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            View Job →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function MyApplicationsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, reviewed: 0, shortlisted: 0, hired: 0, rejected: 0 })
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setAuthed(false)
        router.push('/login?redirect=/jobs/applications/mine')
      } else {
        setAuthed(true)
      }
    })
  }, [router])

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    fetch('/api/jobs/applications/mine')
      .then(r => r.json())
      .then(d => {
        setApplications(d.applications ?? [])
        setStats(d.stats ?? { total: 0, pending: 0, reviewed: 0, shortlisted: 0, hired: 0, rejected: 0 })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [authed])

  const filtered = filter === 'all' ? applications : applications.filter(a => a.status === filter)

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',         label: 'All',         count: stats.total },
    { key: 'pending',     label: '⏳ Pending',   count: stats.pending },
    { key: 'shortlisted', label: '⭐ Shortlisted',count: stats.shortlisted },
    { key: 'hired',       label: '✅ Hired',      count: stats.hired },
    { key: 'rejected',    label: '❌ Rejected',   count: stats.rejected },
  ]

  if (authed === null || (authed && loading)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#38bdf8', fontSize: '1rem' }}>Loading your applications…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <Link href="/jobs" style={{ color: '#64748b', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-block', marginBottom: '0.5rem' }}>
              ← Back to Jobs
            </Link>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>My Applications</h1>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Track the status of your job applications</p>
          </div>
          <Link href="/jobs" style={{
            background: '#38bdf8', color: '#0f172a', borderRadius: 8,
            padding: '0.6rem 1.2rem', fontSize: '0.85rem', fontWeight: 700,
            textDecoration: 'none', display: 'inline-block',
          }}>
            Browse Jobs
          </Link>
        </div>

        {/* Stats bar */}
        {stats.total > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '0.75rem', marginBottom: '1.5rem',
          }}>
            {[
              { label: 'Total', value: stats.total, color: '#f1f5f9' },
              { label: 'Pending', value: stats.pending, color: '#fbbf24' },
              { label: 'Shortlisted', value: stats.shortlisted, color: '#a78bfa' },
              { label: 'Hired', value: stats.hired, color: '#34d399' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#1e293b', borderRadius: 10, padding: '0.85rem',
                border: '1px solid rgba(148,163,184,0.1)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
          marginBottom: '1.25rem', borderBottom: '1px solid rgba(148,163,184,0.1)', paddingBottom: '0.75rem',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                background: filter === tab.key ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: filter === tab.key ? '#38bdf8' : '#64748b',
                border: filter === tab.key ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                borderRadius: 7, padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {tab.label} {tab.count > 0 && <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({tab.count})</span>}
            </button>
          ))}
        </div>

        {/* Applications list */}
        {filtered.length === 0 ? (
          <div style={{
            background: '#1e293b', borderRadius: 12, padding: '3rem 2rem',
            textAlign: 'center', border: '1px solid rgba(148,163,184,0.1)',
          }}>
            {stats.total === 0 ? (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📨</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>No applications yet</div>
                <div style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                  You haven't applied to any jobs yet. Browse open positions and apply today.
                </div>
                <Link href="/jobs" style={{
                  background: '#38bdf8', color: '#0f172a', borderRadius: 8,
                  padding: '0.65rem 1.5rem', fontSize: '0.9rem', fontWeight: 700,
                  textDecoration: 'none', display: 'inline-block',
                }}>
                  Browse Jobs →
                </Link>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                <div style={{ color: '#64748b', fontSize: '0.9rem' }}>No {filter} applications.</div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filtered.map(app => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
