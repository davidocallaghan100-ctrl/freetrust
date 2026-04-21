'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ICP_CATEGORIES } from '@/lib/outbound/sequences'

// ── Types ──────────────────────────────────────────────────────────────────────
interface OutboundLead {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  business_name: string | null
  icp_category: string | null
  source: string | null
  status: string
  sequence_step: number
  last_sent_at: string | null
  enrolled_at: string
  notes: string | null
}

interface IcpStat {
  total: number
  enrolled: number
  contacted: number
  replied: number
  booked: number
  step1_sent: number
  step2_sent: number
  step3_sent: number
}

interface OutboundStatus {
  summary: {
    total_leads: number
    emails_sent: number
    status_breakdown: Record<string, number>
  }
  by_icp: Record<string, IcpStat>
}

const STATUS_COLORS: Record<string, string> = {
  new: '#64748b',
  enrolled: '#38bdf8',
  contacted: '#a78bfa',
  replied: '#34d399',
  booked: '#fbbf24',
  unsubscribed: '#f87171',
}

const STEP_LABELS = ['—', 'Email 1 sent', 'Email 2 sent', 'Sequence complete']

// ── Main component ─────────────────────────────────────────────────────────────
export default function OutboundPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState<OutboundStatus | null>(null)
  const [leads, setLeads] = useState<OutboundLead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [icpFilter, setIcpFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'leads'>('overview')
  const [enrollingAll, setEnrollingAll] = useState(false)
  const [enrollMsg, setEnrollMsg] = useState('')

  // Auth check — must be before any early returns
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || profile.role !== 'admin') { router.push('/'); return }
      setAuthorized(true)
      setLoading(false)
    }
    init()
  }, [router])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/outbound/status')
      if (res.ok) setStats(await res.json())
    } catch { /* silent */ }
  }, [])

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true)
    try {
      const supabase = createClient()
      let q = supabase
        .from('outbound_leads')
        .select('*')
        .order('enrolled_at', { ascending: false })
        .limit(200)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      if (icpFilter !== 'all') q = q.eq('icp_category', icpFilter)
      const { data } = await q
      setLeads((data as OutboundLead[]) ?? [])
    } catch { /* silent */ }
    finally { setLeadsLoading(false) }
  }, [statusFilter, icpFilter])

  useEffect(() => {
    if (!authorized) return
    loadStats()
  }, [authorized, loadStats])

  useEffect(() => {
    if (!authorized || activeTab !== 'leads') return
    loadLeads()
  }, [authorized, activeTab, loadLeads])

  async function handleEnrollAll() {
    setEnrollingAll(true)
    setEnrollMsg('')
    try {
      const supabase = createClient()
      const { data: newLeads } = await supabase
        .from('outbound_leads')
        .select('id, email, first_name, business_name, icp_category, source')
        .eq('status', 'new')
        .not('email', 'is', null)
        .limit(500)

      if (!newLeads?.length) {
        setEnrollMsg('No new leads to enroll.')
        return
      }

      let enrolled = 0, skipped = 0, errors = 0
      for (const lead of newLeads) {
        try {
          const res = await fetch('/api/outbound/enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: lead.email,
              first_name: lead.first_name,
              business_name: lead.business_name,
              icp_category: lead.icp_category,
              source: lead.source,
            }),
          })
          if (res.status === 201) enrolled++
          else if (res.status === 409) skipped++
          else errors++
        } catch { errors++ }
      }

      setEnrollMsg(`Enrolled ${enrolled} new leads. Already enrolled: ${skipped}. Errors: ${errors}.`)
      await loadStats()
    } catch (err) {
      setEnrollMsg('Error enrolling leads.')
    } finally {
      setEnrollingAll(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading…</div>
      </div>
    )
  }
  if (!authorized) return null

  const summary = stats?.summary
  const byIcp = stats?.by_icp ?? {}
  const totalLeads = summary?.total_leads ?? 0
  const emailsSent = summary?.emails_sent ?? 0
  const statusBreakdown = summary?.status_breakdown ?? {}
  const repliedCount = statusBreakdown['replied'] ?? 0
  const bookedCount = statusBreakdown['booked'] ?? 0

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .ob-tab { background:transparent;border:1px solid transparent;border-radius:7px;padding:0.4rem 0.9rem;font-size:0.82rem;font-weight:500;color:#64748b;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .ob-tab:hover { color:#94a3b8;background:rgba(148,163,184,0.06); }
        .ob-tab.active { background:rgba(56,189,248,0.1);border-color:rgba(56,189,248,0.25);color:#38bdf8;font-weight:700; }
        .ob-table { width:100%;border-collapse:collapse; }
        .ob-table th { text-align:left;font-size:0.73rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;padding:0.6rem 0.9rem;border-bottom:1px solid rgba(56,189,248,0.08); }
        .ob-table td { padding:0.7rem 0.9rem;border-bottom:1px solid rgba(56,189,248,0.04);font-size:0.83rem;color:#cbd5e1; }
        .ob-table tr:hover td { background:rgba(56,189,248,0.025); }
        .ob-btn { background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);border-radius:7px;padding:0.45rem 1rem;font-size:0.82rem;font-weight:600;color:#38bdf8;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .ob-btn:hover { background:rgba(56,189,248,0.18); }
        .ob-btn:disabled { opacity:0.5;cursor:not-allowed; }
        .ob-btn-green { background:rgba(52,211,153,0.1);border-color:rgba(52,211,153,0.25);color:#34d399; }
        .ob-btn-green:hover { background:rgba(52,211,153,0.18); }
        select.ob-select { background:#1e293b;border:1px solid rgba(56,189,248,0.15);border-radius:7px;color:#f1f5f9;padding:0.4rem 0.7rem;font-size:0.82rem;outline:none;font-family:inherit;cursor:pointer; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.06) 0%,transparent 100%)', padding: '2rem 1.5rem 1.2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                <span style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, padding: '0.12rem 0.55rem', fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8' }}>ADMIN</span>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Outbound Sales</h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>FreeTrust cold outreach — 26 ICP sequences targeting Irish service providers</p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/admin" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'none' }}>← Admin</a>
              <button className="ob-btn ob-btn-green" onClick={handleEnrollAll} disabled={enrollingAll}>
                {enrollingAll ? 'Enrolling…' : '⚡ Enroll All New Leads'}
              </button>
            </div>
          </div>

          {enrollMsg && (
            <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.83rem', color: '#34d399', marginBottom: '1rem' }}>
              {enrollMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['overview', 'leads'] as const).map(tab => (
              <button key={tab} className={`ob-tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab === 'overview' ? '📊 Overview' : '👥 Leads'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: 'Total Leads', value: totalLeads, color: '#38bdf8', icon: '👥' },
                { label: 'Emails Sent', value: emailsSent, color: '#a78bfa', icon: '📧' },
                { label: 'Enrolled', value: statusBreakdown['enrolled'] ?? 0, color: '#38bdf8', icon: '✅' },
                { label: 'Contacted', value: statusBreakdown['contacted'] ?? 0, color: '#818cf8', icon: '📬' },
                { label: 'Replied', value: repliedCount, color: '#34d399', icon: '💬' },
                { label: 'Booked', value: bookedCount, color: '#fbbf24', icon: '🎯' },
              ].map(s => (
                <div key={s.label} style={{ background: '#1e293b', border: `1px solid ${s.color}20`, borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>{s.icon}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Per-ICP table */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>Per-ICP Breakdown</h2>
                <button className="ob-btn" onClick={loadStats} style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}>↻ Refresh</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ob-table">
                  <thead>
                    <tr>
                      <th>ICP Category</th>
                      <th>Total</th>
                      <th>Enrolled</th>
                      <th>Email 1</th>
                      <th>Email 2</th>
                      <th>Sequence Done</th>
                      <th>Replied</th>
                      <th>Booked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ICP_CATEGORIES.map(cat => {
                      const s = byIcp[cat] ?? { total: 0, enrolled: 0, step1_sent: 0, step2_sent: 0, step3_sent: 0, replied: 0, booked: 0 }
                      return (
                        <tr key={cat}>
                          <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{cat}</td>
                          <td style={{ color: s.total > 0 ? '#38bdf8' : '#475569', fontWeight: s.total > 0 ? 700 : 400 }}>{s.total}</td>
                          <td>{s.enrolled}</td>
                          <td style={{ color: s.step1_sent > 0 ? '#a78bfa' : '#475569' }}>{s.step1_sent}</td>
                          <td style={{ color: s.step2_sent > 0 ? '#818cf8' : '#475569' }}>{s.step2_sent}</td>
                          <td style={{ color: s.step3_sent > 0 ? '#34d399' : '#475569' }}>{s.step3_sent}</td>
                          <td style={{ color: s.replied > 0 ? '#34d399' : '#475569', fontWeight: s.replied > 0 ? 700 : 400 }}>{s.replied}</td>
                          <td style={{ color: s.booked > 0 ? '#fbbf24' : '#475569', fontWeight: s.booked > 0 ? 700 : 400 }}>{s.booked}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* How to use */}
            <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem 1.5rem', marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', margin: '0 0 0.75rem' }}>📋 How to populate leads</h3>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.8 }}>
                <p style={{ margin: '0 0 0.5rem' }}><strong style={{ color: '#f1f5f9' }}>1. Run scrapers</strong> from <code style={{ background: '#0f172a', borderRadius: 4, padding: '0.1rem 0.4rem', color: '#38bdf8' }}>/home/computer/freetrust-outbound/scripts/</code></p>
                <p style={{ margin: '0 0 0.5rem' }}>Run Wave 1 first: <code style={{ background: '#0f172a', borderRadius: 4, padding: '0.1rem 0.4rem', color: '#38bdf8' }}>APIFY_API_TOKEN=xxx node run-wave1.js</code></p>
                <p style={{ margin: '0 0 0.5rem' }}><strong style={{ color: '#f1f5f9' }}>2. Sync to Supabase</strong>: <code style={{ background: '#0f172a', borderRadius: 4, padding: '0.1rem 0.4rem', color: '#38bdf8' }}>SUPABASE_KEY=xxx node sync-to-supabase.js</code></p>
                <p style={{ margin: 0 }}><strong style={{ color: '#f1f5f9' }}>3. Click "Enroll All New Leads"</strong> above — the hourly cron will then send emails automatically.</p>
              </div>
            </div>
          </>
        )}

        {/* ── Leads Tab ── */}
        {activeTab === 'leads' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="ob-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="enrolled">Enrolled</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="booked">Booked</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
              <select
                className="ob-select"
                value={icpFilter}
                onChange={e => setIcpFilter(e.target.value)}
              >
                <option value="all">All ICPs</option>
                {ICP_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button className="ob-btn" onClick={loadLeads} style={{ fontSize: '0.78rem' }}>↻ Refresh</button>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{leads.length} leads shown</span>
            </div>

            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              {leadsLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading leads…</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="ob-table">
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Business</th>
                        <th>ICP</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Sequence</th>
                        <th>Last Sent</th>
                        <th>Enrolled</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map(lead => (
                        <tr key={lead.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.83rem' }}>
                              {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{lead.email || '—'}</div>
                          </td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lead.business_name || '—'}
                          </td>
                          <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#94a3b8' }}>
                            {lead.icp_category || '—'}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.72rem', background: lead.source === 'linkedin' ? 'rgba(56,189,248,0.1)' : 'rgba(52,211,153,0.1)', color: lead.source === 'linkedin' ? '#38bdf8' : '#34d399', border: `1px solid ${lead.source === 'linkedin' ? 'rgba(56,189,248,0.2)' : 'rgba(52,211,153,0.2)'}`, borderRadius: 999, padding: '0.1rem 0.45rem' }}>
                              {lead.source || 'manual'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.72rem', background: `${STATUS_COLORS[lead.status] || '#64748b'}15`, color: STATUS_COLORS[lead.status] || '#64748b', border: `1px solid ${STATUS_COLORS[lead.status] || '#64748b'}30`, borderRadius: 999, padding: '0.1rem 0.45rem', fontWeight: 700 }}>
                              {lead.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: (lead.sequence_step ?? 0) > 0 ? '#a78bfa' : '#475569' }}>
                            {STEP_LABELS[lead.sequence_step ?? 0]}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>
                            {lead.last_sent_at ? new Date(lead.last_sent_at).toLocaleDateString('en-IE') : '—'}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>
                            {new Date(lead.enrolled_at).toLocaleDateString('en-IE')}
                          </td>
                          <td>
                            <select
                              className="ob-select"
                              style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                              value={lead.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value
                                const supabase = createClient()
                                await supabase.from('outbound_leads').update({ status: newStatus }).eq('id', lead.id)
                                setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l))
                              }}
                            >
                              <option value="new">new</option>
                              <option value="enrolled">enrolled</option>
                              <option value="contacted">contacted</option>
                              <option value="replied">replied</option>
                              <option value="booked">booked</option>
                              <option value="unsubscribed">unsubscribed</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {leads.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            No leads yet. Run the scrapers to populate leads.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
