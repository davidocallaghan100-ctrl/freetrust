'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ChartPoint = { label: string; value: number }
type NamedCount = { name: string; count: number }

type AdminPayload = {
  queriedAt: string
  adminEmail: string
  adminAccess: {
    owner: string
    mode: string
    approvedEmails: string[]
    currentEmail: string
    nonAdminPageBehavior: string
    nonAdminApiBehavior: string
    protectionLayers: { layer: string; behavior: string }[]
  }
  dataSource: {
    supabaseProjectRef: string
    emailTablesFound: Record<string, boolean>
    emailDeliveryQuery: string
    errors: { source: string; error: string }[]
  }
  website: {
    tokenConfigured: boolean
    dashboardUrl: string
    note: string
    dailyPageViews: number | null
    weeklyPageViews: number | null
    monthlyPageViews: number | null
    uniqueVisitors: number | null
    topPages: NamedCount[]
    bounceIndicators: NamedCount[]
  }
  users: {
    total: number
    new7: number
    new30: number
    byCountry: NamedCount[]
    byRegion: NamedCount[]
    signupSeries: ChartPoint[]
    verified: number
    unverified: number
    withTrustCoin: number
    withoutTrustCoin: number
  }
  trustScores: {
    available: boolean
    note: string
    average: number | null
    histogram: ChartPoint[]
    topUsers: { name: string; score: number }[]
    trend: ChartPoint[]
  }
  marketplace: {
    totalActive: number
    new7: number
    new30: number
    byCategory: NamedCount[]
    byLocation: NamedCount[]
    topListings: { id: string; title: string; views: number; saves: number; status: string; productType: string }[]
    externalProductClicks: number
  }
  messaging: { total: number; last7: number; last30: number; activeThreads: NamedCount[]; averagePerUser: number }
  emailNotifications: {
    totalSent: number
    sent7: number
    sent30: number
    successRate: number
    typeBreakdown: NamedCount[]
    mostTriggeredType: NamedCount | null
    optInEnabled: number
    optInDisabled: number
    optInRate: number
    recent: { email: string; type: string; sentAt: string; status: string }[]
    dedicatedLoggingImplemented: boolean
    emptyStateSchema: string
  }
  engagement: {
    dau: number
    wau: number
    mau: number
    eventSeries: ChartPoint[]
    eventsByType: NamedCount[]
    lastLoginBuckets: NamedCount[]
    averageSessionCountPerUser: number
  }
  trustCoin: {
    inCirculation: number
    transactions30: number
    byType: NamedCount[]
    trend: ChartPoint[]
    topEarners: { userId: string; name: string; balance: number; lifetime: number }[]
    topSpenders: { userId: string; name: string; spent: number }[]
  }
  platformHealth: {
    databaseConnected: boolean
    authActive: boolean
    majorTables: { table: string; count: number; error: string | null }[]
    recentAuthErrors: unknown[]
    failedSignups: unknown[]
  }
  contentActivity: { feedPosts: number; feedComments: number; feedPostTypes: NamedCount[] }
  orders: { total: number; last30: number; byStatus: NamedCount[] }
}

const SECTIONS = [
  ['overview', 'Overview'],
  ['david-only', 'David Only'],
  ['users', 'Users'],
  ['trust', 'Trust Scores'],
  ['marketplace', 'Marketplace'],
  ['messaging', 'Messaging'],
  ['email', 'Email Notifications'],
  ['engagement', 'Engagement'],
  ['health', 'Platform Health'],
] as const

function fmt(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('en-IE')
}

function fmtDate(value: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' })
}

function StatCard({ label, value, sub, accent = '#38bdf8' }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="ft-admin-card ft-admin-stat" style={{ borderColor: `${accent}33` }}>
      <div className="ft-admin-stat-value" style={{ color: accent }}>{value}</div>
      <div className="ft-admin-stat-label">{label}</div>
      {sub ? <div className="ft-admin-stat-sub">{sub}</div> : null}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="ft-admin-empty">{children}</div>
}

function SectionCard({ id, title, updatedAt, onRefresh, loading, children }: {
  id: string
  title: string
  updatedAt: string
  onRefresh: () => void
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <section id={id} className="ft-admin-section">
      <div className="ft-admin-section-head">
        <div>
          <h2>{title}</h2>
          <p>Last updated {fmtDate(updatedAt)}</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="ft-admin-refresh">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {children}
    </section>
  )
}

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ft-admin-card ft-admin-chart-card">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function BarViz({ data, color = '#38bdf8' }: { data: ChartPoint[]; color?: string }) {
  if (!data.some(point => point.value > 0)) return <EmptyState>No data yet.</EmptyState>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10, color: '#e2e8f0' }} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function LineViz({ data, color = '#34d399' }: { data: ChartPoint[]; color?: string }) {
  if (!data.some(point => point.value > 0)) return <EmptyState>No data yet.</EmptyState>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, color: '#e2e8f0' }} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function CountList({ rows, limit = 8 }: { rows: NamedCount[]; limit?: number }) {
  const visible = rows.slice(0, limit)
  if (!visible.length) return <EmptyState>No data yet.</EmptyState>
  const max = Math.max(...visible.map(row => row.count), 1)
  return (
    <div className="ft-admin-count-list">
      {visible.map(row => (
        <div key={row.name} className="ft-admin-count-row">
          <span>{row.name}</span>
          <div><i style={{ width: `${Math.max((row.count / max) * 100, 5)}%` }} /></div>
          <strong>{fmt(row.count)}</strong>
        </div>
      ))}
    </div>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <EmptyState>No data yet.</EmptyState>
  return (
    <div className="ft-admin-table-wrap">
      <table className="ft-admin-table">
        <thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function AdminDashboardClient() {
  const [data, setData] = useState<AdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Admin analytics failed with ${res.status}`)
      setData(await res.json() as AdminPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const updatedAt = data?.queriedAt ?? new Date().toISOString()
  const nav = useMemo(() => SECTIONS, [])

  return (
    <main className="ft-admin-shell" id="main-content">
      <style>{`
        .ft-admin-shell{min-height:100vh;background:radial-gradient(circle at top left,rgba(56,189,248,.14),transparent 32rem),#07111f;color:#e2e8f0;font-family:var(--font-geist-sans),system-ui,sans-serif;display:grid;grid-template-columns:260px minmax(0,1fr)}
        .ft-admin-sidebar{position:sticky;top:0;height:100vh;border-right:1px solid rgba(56,189,248,.14);background:rgba(7,17,31,.86);backdrop-filter:blur(18px);padding:1.15rem;overflow:auto}
        .ft-admin-brand{display:flex;align-items:center;gap:.75rem;padding:.6rem .55rem 1.1rem;border-bottom:1px solid rgba(148,163,184,.1);margin-bottom:1rem}.ft-admin-logo{width:38px;height:38px;border-radius:14px;background:linear-gradient(135deg,#38bdf8,#00d4aa);display:grid;place-items:center;color:#06111f;font-weight:900}.ft-admin-brand strong{display:block}.ft-admin-brand span{display:block;color:#64748b;font-size:.78rem;margin-top:.1rem}
        .ft-admin-nav{display:grid;gap:.35rem}.ft-admin-nav a{display:block;padding:.72rem .78rem;border-radius:13px;color:#94a3b8;font-size:.88rem;font-weight:750}.ft-admin-nav a:hover{background:rgba(56,189,248,.1);color:#e0f2fe}.ft-admin-secure{margin-top:1.25rem;padding:.8rem;border-radius:16px;border:1px solid rgba(52,211,153,.25);background:rgba(52,211,153,.07);font-size:.76rem;color:#86efac;line-height:1.5}
        .ft-admin-main{min-width:0;padding:1.25rem 1.4rem 3rem}.ft-admin-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.2rem;padding:1rem 1.05rem;border:1px solid rgba(56,189,248,.13);border-radius:22px;background:rgba(15,23,42,.72);box-shadow:0 24px 80px rgba(0,0,0,.25)}.ft-admin-topbar h1{font-size:clamp(1.45rem,2.8vw,2.15rem);margin:0;letter-spacing:-.04em}.ft-admin-topbar p{margin:.25rem 0 0;color:#64748b;font-size:.88rem}.ft-admin-email{text-align:right;color:#94a3b8;font-size:.82rem}.ft-admin-email strong{display:block;color:#e2e8f0;margin-bottom:.2rem}
        .ft-admin-section{scroll-margin-top:1rem;margin-bottom:1.25rem}.ft-admin-section-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1.4rem 0 .75rem}.ft-admin-section h2{margin:0;font-size:1.05rem}.ft-admin-section p{margin:.15rem 0 0;color:#64748b;font-size:.78rem}.ft-admin-refresh{min-height:44px;padding:.55rem .85rem;border-radius:12px;border:1px solid rgba(56,189,248,.22);background:rgba(56,189,248,.08);color:#7dd3fc;font-weight:800;font-size:.82rem}.ft-admin-refresh:disabled{opacity:.6}
        .ft-admin-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem}.ft-admin-two{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.ft-admin-three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.8rem}.ft-admin-card{background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(15,23,42,.72));border:1px solid rgba(148,163,184,.14);border-radius:20px;padding:1rem;box-shadow:0 20px 70px rgba(0,0,0,.18);min-width:0}.ft-admin-card h3{font-size:.88rem;margin:0 0 .8rem;color:#f8fafc}.ft-admin-stat-value{font-size:1.75rem;font-weight:900;letter-spacing:-.04em;line-height:1}.ft-admin-stat-label{margin-top:.45rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;font-size:.68rem;font-weight:900}.ft-admin-stat-sub{color:#64748b;font-size:.76rem;margin-top:.2rem}
        .ft-admin-chart-card{min-height:290px}.ft-admin-empty{border:1px dashed rgba(148,163,184,.22);border-radius:15px;color:#64748b;padding:1.2rem;font-size:.82rem;line-height:1.55;background:rgba(2,6,23,.22)}.ft-admin-note{color:#94a3b8;font-size:.82rem;line-height:1.6}.ft-admin-note code,.ft-admin-code{font-family:var(--font-geist-mono),monospace;font-size:.75rem;color:#bae6fd;white-space:pre-wrap;word-break:break-word}.ft-admin-status{display:inline-flex;align-items:center;gap:.35rem;border:1px solid rgba(52,211,153,.22);background:rgba(52,211,153,.08);color:#86efac;border-radius:999px;padding:.28rem .55rem;font-size:.74rem;font-weight:800}.ft-admin-warn{border-color:rgba(251,191,36,.22);background:rgba(251,191,36,.08);color:#fde68a}
        .ft-admin-count-list{display:grid;gap:.72rem}.ft-admin-count-row{display:grid;grid-template-columns:minmax(88px,1.2fr) minmax(80px,2fr) auto;gap:.65rem;align-items:center;font-size:.8rem;color:#cbd5e1}.ft-admin-count-row div{height:8px;border-radius:999px;background:rgba(148,163,184,.13);overflow:hidden}.ft-admin-count-row i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#00d4aa)}.ft-admin-count-row strong{color:#f8fafc}.ft-admin-table-wrap{overflow:auto}.ft-admin-table{width:100%;border-collapse:collapse;min-width:540px}.ft-admin-table th{text-align:left;color:#64748b;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;padding:.65rem;border-bottom:1px solid rgba(148,163,184,.12)}.ft-admin-table td{padding:.7rem .65rem;border-bottom:1px solid rgba(148,163,184,.08);font-size:.8rem;color:#cbd5e1}.ft-admin-table tr:last-child td{border-bottom:0}.ft-admin-pill{display:inline-block;padding:.2rem .48rem;border-radius:999px;background:rgba(56,189,248,.1);color:#7dd3fc;font-size:.72rem;font-weight:800}
        @media(max-width:1050px){.ft-admin-shell{grid-template-columns:1fr}.ft-admin-sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid rgba(56,189,248,.14)}.ft-admin-nav{display:flex;overflow:auto;padding-bottom:.25rem}.ft-admin-nav a{white-space:nowrap}.ft-admin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ft-admin-two,.ft-admin-three{grid-template-columns:1fr}.ft-admin-topbar{flex-direction:column}.ft-admin-email{text-align:left}}
        @media(max-width:560px){.ft-admin-main{padding:.8rem .8rem 2rem}.ft-admin-grid{grid-template-columns:1fr}.ft-admin-section-head{align-items:flex-start;flex-direction:column}.ft-admin-refresh{width:100%}.ft-admin-card{border-radius:16px}.ft-admin-count-row{grid-template-columns:1fr auto}.ft-admin-count-row div{grid-column:1/-1;order:3}.ft-admin-topbar{border-radius:18px}.ft-admin-sidebar{padding:.85rem}}
      `}</style>

      <aside className="ft-admin-sidebar" aria-label="Admin sections">
        <div className="ft-admin-brand">
          <div className="ft-admin-logo">₮</div>
          <div><strong>FreeTrust Admin</strong><span>Internal analytics</span></div>
        </div>
        <nav className="ft-admin-nav">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        <div className="ft-admin-secure">David-only dashboard. Locked to exact approved Supabase auth emails; non-matching sessions redirect home.</div>
      </aside>

      <div className="ft-admin-main">
        <header className="ft-admin-topbar">
          <div>
            <h1>FreeTrust Admin</h1>
            <p>{now.toLocaleString('en-IE', { dateStyle: 'full', timeStyle: 'short' })}</p>
          </div>
          <div className="ft-admin-email"><strong>{data?.adminEmail ?? 'Checking access…'}</strong><span>Project {data?.dataSource.supabaseProjectRef ?? 'tioqakxnqjxyuzgnwhrb'}</span></div>
        </header>

        {error ? <div className="ft-admin-card" style={{ borderColor: 'rgba(248,113,113,.4)', color: '#fecaca' }}>{error}</div> : null}
        {!data && loading ? <div className="ft-admin-card">Loading admin analytics…</div> : null}

        {data ? (
          <>
            <SectionCard id="overview" title="Overview" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="Registered users" value={fmt(data.users.total)} sub={`+${fmt(data.users.new7)} last 7d`} />
                <StatCard label="Active listings" value={fmt(data.marketplace.totalActive)} sub={`+${fmt(data.marketplace.new30)} last 30d`} accent="#fb923c" />
                <StatCard label="Messages" value={fmt(data.messaging.total)} sub={`${fmt(data.messaging.last30)} last 30d`} accent="#a78bfa" />
                <StatCard label="Trust Coin in circulation" value={`₮${fmt(data.trustCoin.inCirculation)}`} sub={`${fmt(data.trustCoin.transactions30)} ledger tx / 30d`} accent="#fbbf24" />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <ChartShell title="Signup trend"><LineViz data={data.users.signupSeries} /></ChartShell>
                <ChartShell title="Engagement events"><LineViz data={data.engagement.eventSeries} color="#a78bfa" /></ChartShell>
              </div>
            </SectionCard>

            <SectionCard id="david-only" title="David-Only Access" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="Dedicated owner" value={data.adminAccess.owner} sub="No shared admin roles" accent="#34d399" />
                <StatCard label="Current session" value={data.adminAccess.currentEmail} sub="Supabase auth email matched exactly" />
                <StatCard label="Approved emails" value={fmt(data.adminAccess.approvedEmails.length)} sub={data.adminAccess.approvedEmails.join(' · ')} accent="#fbbf24" />
                <StatCard label="Access model" value="Exact email" sub={data.adminAccess.mode} accent="#a78bfa" />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <div className="ft-admin-card">
                  <h3>Only David can access this dashboard</h3>
                  <p className="ft-admin-note">The dashboard is intentionally not tied to profile roles. Access is granted only when the authenticated Supabase email is one of David's approved emails. Other users do not see the Analytics Dashboard menu item.</p>
                  <div style={{ display: 'grid', gap: '.55rem', marginTop: '.9rem' }}>
                    <span className="ft-admin-status">Page access: {data.adminAccess.nonAdminPageBehavior}</span>
                    <span className="ft-admin-status ft-admin-warn">API access: {data.adminAccess.nonAdminApiBehavior}</span>
                  </div>
                </div>
                <div className="ft-admin-card">
                  <h3>Protection layers</h3>
                  <DataTable
                    headers={['Layer', 'Behavior']}
                    rows={data.adminAccess.protectionLayers.map(row => [row.layer, row.behavior])}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard id="users" title="User Analytics" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="New users / 7d" value={fmt(data.users.new7)} />
                <StatCard label="New users / 30d" value={fmt(data.users.new30)} />
                <StatCard label="Verified users" value={fmt(data.users.verified)} sub={`${fmt(data.users.unverified)} unverified`} accent="#34d399" />
                <StatCard label="Trust Coin users" value={fmt(data.users.withTrustCoin)} sub={`${fmt(data.users.withoutTrustCoin)} without Trust Coin balance`} accent="#fbbf24" />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <ChartShell title="Users by country/region"><CountList rows={[...data.users.byCountry.slice(0, 6), ...data.users.byRegion.slice(0, 4)]} /></ChartShell>
                <ChartShell title="Signup date line graph"><LineViz data={data.users.signupSeries} /></ChartShell>
              </div>
            </SectionCard>

            <SectionCard id="trust" title="Trust Score Analytics" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="Average Trust Score" value={fmt(data.trustScores.average)} />
                <StatCard label="Score source" value={data.trustScores.available ? 'Live' : 'Not found'} sub="No fake inferred score" accent="#f87171" />
                <StatCard label="Top score users" value={fmt(data.trustScores.topUsers.length)} />
                <StatCard label="Distribution buckets" value={fmt(data.trustScores.histogram.reduce((sum, row) => sum + row.value, 0))} />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <ChartShell title="Trust Score distribution"><BarViz data={data.trustScores.histogram} color="#fbbf24" /></ChartShell>
                <div className="ft-admin-card"><h3>Trust Score source status</h3><EmptyState>{data.trustScores.note}</EmptyState></div>
              </div>
            </SectionCard>

            <SectionCard id="marketplace" title="Marketplace & Listings Analytics" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="Active listings" value={fmt(data.marketplace.totalActive)} />
                <StatCard label="New listings / 7d" value={fmt(data.marketplace.new7)} />
                <StatCard label="New listings / 30d" value={fmt(data.marketplace.new30)} />
                <StatCard label="External product clicks" value={fmt(data.marketplace.externalProductClicks)} />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <ChartShell title="Listings by category"><CountList rows={data.marketplace.byCategory} /></ChartShell>
                <ChartShell title="Listings by location/county"><CountList rows={data.marketplace.byLocation} /></ChartShell>
              </div>
              <div className="ft-admin-card" style={{ marginTop: '.8rem' }}><h3>Most viewed / saved listings</h3><DataTable headers={['Listing', 'Type', 'Views', 'Saves', 'Status']} rows={data.marketplace.topListings.map(row => [row.title, row.productType, fmt(row.views), fmt(row.saves), <span className="ft-admin-pill" key={row.id}>{row.status}</span>])} /></div>
            </SectionCard>

            <SectionCard id="messaging" title="Messaging Analytics" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="Total messages" value={fmt(data.messaging.total)} />
                <StatCard label="Messages / 7d" value={fmt(data.messaging.last7)} />
                <StatCard label="Messages / 30d" value={fmt(data.messaging.last30)} />
                <StatCard label="Avg messages / sender" value={fmt(data.messaging.averagePerUser)} />
              </div>
              <div className="ft-admin-card" style={{ marginTop: '.8rem' }}><h3>Most active conversation threads</h3><CountList rows={data.messaging.activeThreads} /></div>
            </SectionCard>

            <SectionCard id="email" title="Email Notifications Analytics" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="Email notifications sent" value={fmt(data.emailNotifications.totalSent)} sub="campaign_sends table" />
                <StatCard label="Sent / 7d" value={fmt(data.emailNotifications.sent7)} />
                <StatCard label="Sent / 30d" value={fmt(data.emailNotifications.sent30)} />
                <StatCard label="Success rate" value={`${fmt(data.emailNotifications.successRate)}%`} />
                <StatCard label="Email opt-in enabled" value={fmt(data.emailNotifications.optInEnabled)} sub={`${fmt(data.emailNotifications.optInRate)}% opt-in rate`} accent="#34d399" />
                <StatCard label="Email opt-out disabled" value={fmt(data.emailNotifications.optInDisabled)} accent="#f87171" />
                <StatCard label="Most triggered type" value={data.emailNotifications.mostTriggeredType?.name ?? '—'} sub={data.emailNotifications.mostTriggeredType ? `${fmt(data.emailNotifications.mostTriggeredType.count)} notifications` : 'No notification rows'} />
                <StatCard label="Dedicated log table" value={data.emailNotifications.dedicatedLoggingImplemented ? 'Live' : 'Missing'} accent="#fbbf24" />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <ChartShell title="Notification types"><CountList rows={data.emailNotifications.typeBreakdown} /></ChartShell>
                <div className="ft-admin-card"><h3>Email logging empty state</h3><EmptyState>Email notification logging not yet implemented — add an <code>email_logs</code> table to enable a complete delivery section.<br /><br /><code>{data.emailNotifications.emptyStateSchema}</code></EmptyState></div>
              </div>
              <div className="ft-admin-card" style={{ marginTop: '.8rem' }}><h3>Recent email notifications sent</h3><DataTable headers={['Recipient email', 'Notification type', 'Sent timestamp', 'Status']} rows={data.emailNotifications.recent.map(row => [row.email, row.type, fmtDate(row.sentAt), <span className="ft-admin-pill" key={`${row.email}-${row.sentAt}`}>{row.status}</span>])} /></div>
            </SectionCard>

            <SectionCard id="engagement" title="Engagement & Session Metrics" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="DAU" value={fmt(data.engagement.dau)} />
                <StatCard label="WAU" value={fmt(data.engagement.wau)} />
                <StatCard label="MAU" value={fmt(data.engagement.mau)} />
                <StatCard label="Avg event count / user" value={fmt(data.engagement.averageSessionCountPerUser)} />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <ChartShell title="Last login distribution"><CountList rows={data.engagement.lastLoginBuckets} /></ChartShell>
                <ChartShell title="Events by type"><CountList rows={data.engagement.eventsByType} /></ChartShell>
              </div>
            </SectionCard>

            <SectionCard id="health" title="Platform Health" updatedAt={updatedAt} onRefresh={loadData} loading={loading}>
              <div className="ft-admin-grid">
                <StatCard label="Database connected" value={data.platformHealth.databaseConnected ? '✓' : '×'} accent="#34d399" />
                <StatCard label="Auth active" value={data.platformHealth.authActive ? '✓' : '×'} accent="#34d399" />
                <StatCard label="API query errors" value={fmt(data.dataSource.errors.length)} accent={data.dataSource.errors.length ? '#f87171' : '#34d399'} />
                <StatCard label="Vercel Analytics" value={data.website.tokenConfigured ? 'Token set' : 'Token missing'} accent={data.website.tokenConfigured ? '#34d399' : '#fbbf24'} />
              </div>
              <div className="ft-admin-two" style={{ marginTop: '.8rem' }}>
                <div className="ft-admin-card"><h3>Major table row counts</h3><DataTable headers={['Table', 'Rows', 'Status']} rows={data.platformHealth.majorTables.map(row => [row.table, fmt(row.count), row.error ? <span className="ft-admin-pill" key={row.table}>{row.error}</span> : <span className="ft-admin-status" key={row.table}>Connected ✓</span>])} /></div>
                <div className="ft-admin-card"><h3>Website & traffic analytics</h3><p className="ft-admin-note">{data.website.note}</p><p className="ft-admin-note"><Link href={data.website.dashboardUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontWeight: 800 }}>Open Vercel dashboard →</Link></p><div style={{ marginTop: '.8rem' }}><span className={data.website.tokenConfigured ? 'ft-admin-status' : 'ft-admin-status ft-admin-warn'}>{data.website.tokenConfigured ? 'VERCEL_ANALYTICS_TOKEN configured' : 'VERCEL_ANALYTICS_TOKEN missing'}</span></div></div>
              </div>
              <div className="ft-admin-card" style={{ marginTop: '.8rem' }}><h3>Email/notification tables found</h3><DataTable headers={['Table', 'Found']} rows={Object.entries(data.dataSource.emailTablesFound).map(([table, found]) => [table, found ? 'Yes' : 'No'])} /><p className="ft-admin-note" style={{ marginTop: '.8rem' }}>Delivery stats query: <code>{data.dataSource.emailDeliveryQuery}</code></p></div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </main>
  )
}
